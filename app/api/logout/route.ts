import { getIronSession, webCookies } from "iron-session";
import { NextResponse } from "next/server";
import { getSessionOptions, type SessionData } from "@/lib/session";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  const session = await getIronSession<SessionData>(
    webCookies(request, response),
    getSessionOptions(),
  );
  session.destroy();
  return response;
}
