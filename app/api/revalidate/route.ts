import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { NOTES_TAG } from "@/lib/notes";

/*
 * GitHub push webhook -> revalidateTag("notes").
 *
 * The search index (lib/search-index.ts) is cached under the same "notes"
 * tag, so this one call refreshes the note list, every note and the index.
 *
 * Configure on GitHub: Notes repo -> Settings -> Webhooks -> Add webhook
 *   Payload URL:   https://<your-vercel-domain>/api/revalidate
 *   Content type:  application/json
 *   Secret:        the value of REVALIDATE_SECRET (same as in Vercel env)
 *   SSL:           Enable SSL verification
 *   Events:        Just the push event
 *   Active:        checked
 * GitHub then sends a signed "ping"; "Recent Deliveries" should show 200.
 *
 * Order of operations matters: the raw body is read as bytes and its
 * signature verified BEFORE anything else looks at it. Nothing (JSON.parse,
 * header-driven branching on event type, etc.) touches an unverified body.
 *
 * Manual testing: without X-Hub-Signature-256, a correct
 * `x-revalidate-secret: <REVALIDATE_SECRET>` header still revalidates
 * unconditionally (the body is ignored entirely on that path):
 *   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     https://<domain>/api/revalidate
 */

/** Constant-time string comparison. Hashing both sides first gives equal-
 * length buffers, so timingSafeEqual never throws and a length mismatch
 * isn't revealed by an early return. */
function constantTimeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function signatureValid(body: Buffer, header: string, secret: string): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return constantTimeEqual(header, expected);
}

interface PushPayload {
  ref?: unknown;
  repository?: { default_branch?: unknown };
  commits?: unknown;
}

function isNoteFile(path: unknown): boolean {
  return (
    typeof path === "string" &&
    path.startsWith("notes/") &&
    path.endsWith(".md")
  );
}

/** Why this push doesn't affect the app, or null if it does. Reads the
 * payload defensively: it's authenticated, but its shape isn't guaranteed. */
function irrelevantReason(payload: PushPayload): string | null {
  const branch = payload.repository?.default_branch;
  if (typeof branch === "string" && payload.ref !== `refs/heads/${branch}`) {
    // Notes are read from the default branch only (lib/notes.ts).
    return `push to ${String(payload.ref)}, not the default branch`;
  }
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  const touchesNotes = commits.some((commit) =>
    (["added", "modified", "removed"] as const).some((kind) => {
      const files = (commit as Record<string, unknown> | null)?.[kind];
      return Array.isArray(files) && files.some(isNoteFile);
    }),
  );
  return touchesNotes ? null : "no notes/**/*.md files changed";
}

function revalidateNotes() {
  // { expire: 0 } is the required form for callers outside a Server Action
  // (a webhook here): it makes the current cache entry stale immediately
  // rather than serving it for up to a year under the "max" stale-while-
  // revalidate profile.
  revalidateTag(NOTES_TAG, { expire: 0 });
  return NextResponse.json({
    revalidated: true,
    tag: NOTES_TAG,
    now: Date.now(),
  });
}

function unauthorized(message: string) {
  return NextResponse.json({ revalidated: false, message }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, message: "REVALIDATE_SECRET is not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-hub-signature-256");

  if (signature === null) {
    const manual = request.headers.get("x-revalidate-secret");
    if (manual === null) return unauthorized("Missing signature");
    if (!constantTimeEqual(manual, secret)) return unauthorized("Bad secret");
    console.warn(
      "[revalidate] Accepted x-revalidate-secret header. This path is for " +
        "manual testing only; GitHub webhooks must use a signed payload.",
    );
    return revalidateNotes();
  }

  // Exact bytes GitHub signed; request.text() would decode and could alter
  // them (e.g. invalid UTF-8 replaced), breaking the HMAC.
  const body = Buffer.from(await request.arrayBuffer());
  if (!signatureValid(body, signature, secret)) {
    return unauthorized("Bad signature");
  }

  // ---- Everything below runs on a verified body only. ----

  const event = request.headers.get("x-github-event");
  if (event === "ping") {
    return NextResponse.json({ revalidated: false, message: "pong" });
  }
  if (event !== "push") {
    return NextResponse.json({
      revalidated: false,
      message: `Ignored "${event}" event (only "push" is handled)`,
    });
  }

  let payload: PushPayload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return NextResponse.json(
      { revalidated: false, message: "Body is not JSON" },
      { status: 400 },
    );
  }
  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json(
      { revalidated: false, message: "Body is not a JSON object" },
      { status: 400 },
    );
  }

  const reason = irrelevantReason(payload);
  if (reason) {
    return NextResponse.json({ revalidated: false, message: reason });
  }
  return revalidateNotes();
}
