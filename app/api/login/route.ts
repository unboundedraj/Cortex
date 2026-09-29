import { timingSafeEqual } from "node:crypto";
import { getIronSession, webCookies } from "iron-session";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionOptions, type SessionData } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

/** NextRequest dropped `.ip`; the platform (Vercel or whatever reverse
 * proxy sits in front) is expected to set this header. Not spoof-proof
 * without a trusted proxy in front — fine for a personal app, not a
 * substitute for a real WAF. */
function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

/** Constant-time comparison that also hides length differences: padding
 * the shorter buffer means timingSafeEqual always sees equal-length
 * inputs (it throws otherwise), so a wrong password never short-circuits
 * to a faster or slower path based on its length. */
function safeEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  const paddedProvided = Buffer.alloc(expectedBuf.length);
  providedBuf.copy(paddedProvided);
  const lengthsMatch = providedBuf.length === expectedBuf.length;
  const contentMatches = timingSafeEqual(paddedProvided, expectedBuf);
  return lengthsMatch && contentMatches;
}

export async function POST(request: Request) {
  const password = process.env.EDITOR_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { success: false, message: "EDITOR_PASSWORD is not configured" },
      { status: 500 },
    );
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(clientKey(request), {
    maxAttempts: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { success: false, message: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 },
    );
  }

  const provided =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : "";

  if (!provided || !safeEqual(provided, password)) {
    return NextResponse.json(
      { success: false, message: "Incorrect password" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });
  const session = await getIronSession<SessionData>(
    webCookies(request, response),
    getSessionOptions(),
  );
  session.authenticated = true;
  await session.save();
  return response;
}
