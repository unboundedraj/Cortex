import "server-only";
import { NextResponse } from "next/server";
import { WriteError, type WriteErrorCode } from "@/lib/note-writer";
import { isAuthenticated } from "@/lib/session";

export interface WriteErrorBody {
  error: {
    code: WriteErrorCode | "unauthorized";
    message: string;
    resetAt?: string;
  };
}

/**
 * Defense in depth: every write handler calls this FIRST, independently of
 * proxy.ts. Returns a 401 response to send, or null when the request
 * carries a valid session.
 */
export async function requireSession(): Promise<NextResponse<WriteErrorBody> | null> {
  if (await isAuthenticated()) return null;
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

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new WriteError("validation", "Request body must be valid JSON.", 400);
  }
}

export function writeErrorResponse(
  error: unknown,
): NextResponse<WriteErrorBody> {
  if (error instanceof WriteError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.resetAt ? { resetAt: error.resetAt } : {}),
        },
      },
      {
        status: error.status,
        ...(error.code === "rate_limited" && error.resetAt
          ? {
              headers: {
                "Retry-After": String(
                  Math.max(
                    1,
                    Math.ceil((Date.parse(error.resetAt) - Date.now()) / 1000),
                  ),
                ),
              },
            }
          : {}),
      },
    );
  }
  // Not a WriteError: a bug on our side. Logged, never silently swallowed.
  console.error("[write-api] Unexpected error:", error);
  return NextResponse.json(
    { error: { code: "internal", message: "Unexpected server error." } },
    { status: 500 },
  );
}
