import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { NOTES_TAG } from "@/lib/notes";

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, message: "REVALIDATE_SECRET is not configured" },
      { status: 500 },
    );
  }

  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!secretsMatch(provided, secret)) {
    return NextResponse.json(
      { revalidated: false, message: "Invalid secret" },
      { status: 401 },
    );
  }

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
