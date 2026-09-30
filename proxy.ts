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

  // An API caller that followed a redirect would just receive the login
  // page's HTML with a 200 — answer with a real 401 instead. (The route
  // handlers re-check the session themselves; this is the outer layer.)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "You need to sign in to change notes.",
        },
      },
      { status: 401 },
    );
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
  // `/api/notes/:path*` also matches `/api/notes` itself (`*` = zero or
  // more). /api/revalidate is deliberately excluded — GitHub calls it,
  // authenticated by the webhook signature, not the password gate.
  matcher: ["/edit/:path*", "/new", "/api/notes/:path*"],
};
