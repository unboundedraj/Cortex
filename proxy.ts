import { getIronSession, nextProxyCookies } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionOptions, type SessionData } from "@/lib/session";

/**
 * Next 16 renamed middleware.ts to proxy.ts (the `middleware` export is
 * deprecated; this file must export `proxy` or a default export instead).
 * Proxy now defaults to the Node.js runtime, which is why a plain
 * server-only import like lib/session.ts works here.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    nextProxyCookies(request, response),
    getSessionOptions(),
  );

  if (session.authenticated) {
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  // URLSearchParams handles the encoding — no manual encodeURIComponent.
  loginUrl.searchParams.set(
    "from",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // /api/notes/* doesn't exist yet, but is matched proactively for when
  // write endpoints land there. /api/revalidate is deliberately excluded —
  // it has its own header-secret check, not the password gate.
  matcher: ["/edit/:path*", "/new", "/api/notes/:path*"],
};
