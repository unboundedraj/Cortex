import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  authenticated: boolean;
}

const COOKIE_NAME = "cortex_session";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to .env.local (see .env.local.example).",
    );
  }
  // iron-session enforces this too, but with a generic message — this one
  // points back at where to fix it.
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters long (see .env.local.example for how to generate one).",
    );
  }
  return secret;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: COOKIE_NAME,
    password: getSessionSecret(),
    ttl: THIRTY_DAYS_SECONDS,
    cookieOptions: {
      httpOnly: true,
      // A `secure` cookie is never set by the browser over plain HTTP, so
      // this must be conditional or login would silently fail in local dev.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

/** Read-only session access for Server Components (e.g. gating UI). Can't
 * write cookies here — `next/headers` cookies() is read-only outside Route
 * Handlers and Server Actions. Use webCookies()/nextProxyCookies() there. */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/** Server-side session check for write endpoints — independent of
 * proxy.ts, so a matcher change can't silently expose a write route. A
 * missing, expired, tampered or unsigned cookie all read as an empty
 * session (iron-session never throws on a bad cookie). */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.authenticated === true;
}
