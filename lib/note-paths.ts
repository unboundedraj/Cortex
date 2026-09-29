/*
 * Path rules shared by the editor (live "saved as" preview) and the write
 * API (authoritative validation), so the two can't disagree. No
 * server-only import on purpose.
 */

export const MAX_SLUG_LENGTH = 80;
const MAX_NOTEBOOK_DEPTH = 6;
const MAX_NOTEBOOK_LENGTH = 200;
const UNCATEGORIZED = "uncategorized";

/** ASCII kebab-case: transliterates accents (é -> e), drops everything
 * else that isn't a-z0-9. Scripts with no ASCII transliteration (e.g.
 * Hindi, Chinese) produce "" — callers fall back to a default name. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

export type PathResult =
  { ok: true; value: string } | { ok: false; error: string };

/**
 * Validates a notebook path as typed ("Study/New Topic") and normalizes it
 * to the on-disk form ("study/new-topic"). "" or "uncategorized" means the
 * note lives directly under notes/. Rejects — rather than silently fixing —
 * anything that looks like a path trick: "..", leading/trailing slashes,
 * empty segments, backslashes.
 */
export function normalizeNotebook(input: string): PathResult {
  const raw = input.trim();
  if (raw === "" || raw.toLowerCase() === UNCATEGORIZED) {
    return { ok: true, value: "" };
  }
  if (raw.length > MAX_NOTEBOOK_LENGTH) {
    return { ok: false, error: "Notebook path is too long." };
  }
  if (raw.includes("\\")) {
    return { ok: false, error: "Use forward slashes (/) in notebook paths." };
  }
  if (raw.startsWith("/") || raw.endsWith("/")) {
    return {
      ok: false,
      error: "Notebook path can't start or end with a slash.",
    };
  }
  const segments = raw.split("/");
  if (segments.length > MAX_NOTEBOOK_DEPTH) {
    return {
      ok: false,
      error: `Notebooks can be nested at most ${MAX_NOTEBOOK_DEPTH} levels deep.`,
    };
  }
  const normalized: string[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed === "") {
      return { ok: false, error: "Notebook path has an empty segment (//)." };
    }
    if (trimmed === "." || trimmed === "..") {
      return {
        ok: false,
        error: `"${trimmed}" isn't allowed in a notebook path.`,
      };
    }
    const slug = slugify(trimmed);
    if (!slug) {
      return {
        ok: false,
        error: `"${trimmed}" has no letters or numbers usable in a folder name.`,
      };
    }
    normalized.push(slug);
  }
  return { ok: true, value: normalized.join("/") };
}

/** Rejects ids that could escape notes/ once turned into a file path. */
export function validateNoteId(id: string): PathResult {
  if (!id || id.length > MAX_NOTEBOOK_LENGTH + MAX_SLUG_LENGTH + 16) {
    return { ok: false, error: "Invalid note id." };
  }
  const segments = id.split("/");
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\\") ||
      // Control characters.
      [...segment].some((ch) => ch.charCodeAt(0) < 32)
    ) {
      return { ok: false, error: "Invalid note id." };
    }
  }
  return { ok: true, value: id };
}

export function noteIdFor(notebook: string, slug: string): string {
  return notebook ? `${notebook}/${slug}` : slug;
}

export function notePathFor(id: string): string {
  return `notes/${id}.md`;
}

/** The notebook a note's id implies, in the form normalizeNotebook() accepts. */
export function notebookOfId(id: string): string {
  const index = id.lastIndexOf("/");
  return index === -1 ? "" : id.slice(0, index);
}
