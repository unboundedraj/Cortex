import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { listNotesWithContent, NOTES_TAG } from "@/lib/notes";
import { buildSearchIndex, toSearchText } from "@/lib/search-config";

export interface SerializedSearchIndex {
  /** MiniSearch toJSON() output, already stringified. */
  json: string;
  /** Content hash of `json`: changes exactly when the index changes. */
  version: string;
}

/**
 * Built from the same cached note fetch as the list, and cached under the
 * same "notes" tag — so any revalidateTag("notes") (a save, a delete, the
 * webhook) invalidates the index together with the data it was built from.
 * A sibling cache entry rather than part of the notes entry, so list/note
 * reads don't carry the serialized index around.
 */
export const getSearchIndex = unstable_cache(
  async (): Promise<SerializedSearchIndex> => {
    const notes = await listNotesWithContent();
    const index = buildSearchIndex(
      notes.map((note) => ({
        id: note.id,
        title: note.title,
        notebook: note.notebook,
        tags: note.tags,
        date: note.date,
        pinned: note.pinned,
        body: toSearchText(note.content),
      })),
    );
    const json = JSON.stringify(index);
    const version = createHash("sha256")
      .update(json)
      .digest("hex")
      .slice(0, 16);
    return { json, version };
  },
  ["notes", "searchIndex", "v1"],
  { tags: [NOTES_TAG], revalidate: false },
);

/** Plain text of specific notes' bodies, for result snippets. */
export async function getSearchTexts(
  ids: string[],
): Promise<Record<string, string>> {
  const wanted = new Set(ids);
  const notes = await listNotesWithContent();
  const texts: Record<string, string> = {};
  for (const note of notes) {
    if (wanted.has(note.id)) texts[note.id] = toSearchText(note.content);
  }
  return texts;
}
