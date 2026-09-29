import { NextResponse } from "next/server";
import { deleteNote, updateNote } from "@/lib/note-writer";
import { decodeNoteId } from "@/lib/routes";
import { readJson, requireSession, writeErrorResponse } from "@/lib/write-api";

/** Update a note. Body: { title, tags, content, message, sha }. */
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/notes/[...id]">,
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const id = decodeNoteId((await params).id);
    const result = await updateNote(id, await readJson(request));
    return NextResponse.json(result);
  } catch (error) {
    return writeErrorResponse(error);
  }
}

/** Delete a note. Body: { sha, title? } — the sha is required, so a note
 * that changed since it was loaded is never deleted blindly. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/notes/[...id]">,
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const id = decodeNoteId((await params).id);
    await deleteNote(id, await readJson(request));
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return writeErrorResponse(error);
  }
}
