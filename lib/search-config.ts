import MiniSearch, { type Options, type SearchOptions } from "minisearch";

/*
 * Shared by the server (building the index) and the client (loading and
 * querying it). MiniSearch.loadJSON must be given the same options the index
 * was built with, so they live in exactly one place. Pure module: no
 * server-only, no "@/..." imports.
 */

export interface SearchDoc {
  id: string;
  title: string;
  notebook: string;
  tags: string[];
  date: string;
  pinned: boolean;
  /** Plain text of the note body (see toSearchText). Indexed, NOT stored. */
  body: string;
}

/** Stored per result so a hit can be shown without the note list. The body
 * is deliberately not stored: it would dominate the served index size. */
export interface StoredFields {
  title: string;
  notebook: string;
  tags: string[];
  date: string;
  pinned: boolean;
}

function stripAccents(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export const MINISEARCH_OPTIONS: Options<SearchDoc> = {
  idField: "id",
  fields: ["title", "notebook", "tags", "body"],
  storeFields: ["title", "notebook", "tags", "date", "pinned"],
  // Tags are stored as an array but indexed as words; notebook paths like
  // "study/programming" are indexed as their segments.
  stringifyField: (value, field) =>
    field === "tags" && Array.isArray(value)
      ? value.join(" ")
      : field === "notebook"
        ? String(value).replace(/[/_-]/g, " ")
        : String(value),
  // Applied to both indexed text and queries, so "Résumé" finds "resume".
  processTerm: (term) => stripAccents(term).toLowerCase() || null,
};

/**
 * - prefix: every term matches as a prefix, so results update while a word
 *   is still being typed ("deriv" finds "derivative").
 * - fuzzy 0.15: MiniSearch allows round(length × 0.15) edits — none for
 *   words of 1–3 letters (where one edit turns "the" into "tie"), one for
 *   4–9 letters, two from 10. Tolerates a typo without matching junk.
 * - AND: every word in the query must match, like the old substring search.
 * - boost: a title hit outranks tags/notebook, which outrank the body.
 */
export const SEARCH_OPTIONS: SearchOptions = {
  prefix: true,
  fuzzy: 0.15,
  combineWith: "AND",
  boost: { title: 4, tags: 2, notebook: 1.5, body: 1 },
};

/**
 * Markdown -> plain text for indexing and snippets. Removes syntax
 * characters (#, *, `, |, >, ~, list markers, link/image syntax, table
 * separators) so they don't pollute tokens or snippets, but keeps the
 * content of code blocks searchable — only the fence lines go.
 */
export function toSearchText(markdown: string): string {
  return markdown
    .replace(/^[ \t]*(?:```|~~~).*$/gm, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(
      /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm,
      " ",
    )
    .replace(/^[ \t]*(?:#{1,6}|>+|[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/\[[ xX]\][ \t]+/g, "")
    .replace(/[*`|#>~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>(MINISEARCH_OPTIONS);
  index.addAll(docs);
  return index;
}
