/** Client-side wrapper for the write API (app/api/notes/...). */

export interface WriteFailure {
  status: number;
  code: string;
  message: string;
  resetAt?: string;
}

export type WriteResult<T> =
  { ok: true; data: T } | { ok: false; error: WriteFailure };

export async function callWriteApi<T>(
  url: string,
  init: { method: "POST" | "PUT" | "DELETE"; body: unknown },
): Promise<WriteResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(init.body),
    });
  } catch {
    return {
      ok: false,
      error: {
        status: 0,
        code: "network",
        message:
          "Couldn't reach the server. Check your connection and try again.",
      },
    };
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: payload as T };

  const error =
    payload && typeof payload === "object" && "error" in payload
      ? (payload.error as Partial<WriteFailure>)
      : {};
  return {
    ok: false,
    error: {
      status: response.status,
      code: error.code ?? "unknown",
      message: error.message ?? `The server responded with ${response.status}.`,
      resetAt: error.resetAt,
    },
  };
}

/** A one-line, user-facing explanation, with the reset time for limits. */
export function describeWriteFailure(error: WriteFailure): string {
  if (error.code === "rate_limited" && error.resetAt) {
    const reset = new Date(error.resetAt);
    const minutes = Math.max(
      1,
      Math.ceil((reset.getTime() - Date.now()) / 60000),
    );
    return `${error.message} It resets at ${reset.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} (in about ${minutes} min).`;
  }
  return error.message;
}

export function encodeNoteIdForUrl(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

/** The sha is required: a note that changed since it was loaded is never
 * deleted blindly — GitHub rejects the stale sha with a conflict. */
export function requestDelete(note: {
  id: string;
  sha: string;
  title: string;
}): Promise<WriteResult<{ deleted: true; id: string }>> {
  return callWriteApi(`/api/notes/${encodeNoteIdForUrl(note.id)}`, {
    method: "DELETE",
    body: { sha: note.sha, title: note.title },
  });
}

export function describeDeleteFailure(error: WriteFailure): string {
  switch (error.code) {
    case "unauthorized":
      return "You need to sign in to delete notes.";
    case "conflict":
      return "This note changed elsewhere since this page loaded, so it wasn't deleted. Reload to see the latest version first.";
    case "not_found":
      return "This note was already deleted elsewhere.";
    default:
      return describeWriteFailure(error);
  }
}
