import { NextResponse } from "next/server";
import { createNote } from "@/lib/note-writer";
import { readJson, requireSession, writeErrorResponse } from "@/lib/write-api";

/** Create a note. Body: { title, notebook, tags, content, message }. */
export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const result = await createNote(await readJson(request));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return writeErrorResponse(error);
  }
}
