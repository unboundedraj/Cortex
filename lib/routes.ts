function encodeNoteId(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

export function noteHref(id: string): string {
  return `/notes/${encodeNoteId(id)}`;
}

export function noteEditHref(id: string): string {
  return `/notes/${encodeNoteId(id)}/edit`;
}

/** sessionStorage key holding the last list URL (with its filter params),
 * so "back to notes" links can restore it. */
export const LAST_LIST_URL_KEY = "cortex:last-list-url";
