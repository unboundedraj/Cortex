import {
  DEFAULT_FILTER_STATE,
  serializeFilterState,
  type NoteFilterState,
} from "@/lib/note-filter";

function encodeNoteId(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

/**
 * Inverse of encodeNoteId for catch-all route params. Next.js hands the
 * page each segment still percent-encoded, so every segment is decoded
 * exactly once here. Malformed escapes fall back to the raw segment rather
 * than throwing.
 */
export function decodeNoteId(segments: string[]): string {
  return segments
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

export function noteHref(id: string): string {
  return `/notes/${encodeNoteId(id)}`;
}

export function noteEditHref(id: string): string {
  return `/edit/${encodeNoteId(id)}`;
}

/** A notes-list URL with the given filters, using the same param format
 * the list itself writes (so it restores the filters on arrival). */
export function listHref(filters: Partial<NoteFilterState>): string {
  const query = serializeFilterState({
    ...DEFAULT_FILTER_STATE,
    ...filters,
  }).toString();
  return query ? `/?${query}` : "/";
}
