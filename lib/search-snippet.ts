export interface SnippetPart {
  text: string;
  hit: boolean;
}

const RADIUS = 70;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word matcher for index terms (already lowercased tokens). The
 * lookarounds use letters/digits, so "student" still matches inside
 * "is_student" — the index tokenizes on punctuation the same way. */
function termPattern(terms: string[], flags: string): RegExp {
  const alternatives = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`,
    flags,
  );
}

/**
 * "…the derivative of a composite function…" around the first occurrence
 * of one of `focusTerms` (the body-only matches), with every matched term in
 * the window marked. Returns null if no focus term occurs in the text.
 */
export function buildSnippet(
  text: string,
  focusTerms: string[],
  allTerms: string[],
): SnippetPart[] | null {
  if (!text || focusTerms.length === 0) return null;
  const first = termPattern(focusTerms, "iu").exec(text);
  if (!first) return null;

  let start = Math.max(0, first.index - RADIUS);
  let end = Math.min(text.length, first.index + first[0].length + RADIUS);
  // Snap to word boundaries so the snippet doesn't start mid-word.
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < first.index) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > first.index + first[0].length) end = space;
  }

  const window = text.slice(start, end);
  const parts: SnippetPart[] = [];
  if (start > 0) parts.push({ text: "…", hit: false });
  let cursor = 0;
  for (const match of window.matchAll(termPattern(allTerms, "giu"))) {
    const index = match.index ?? 0;
    if (index > cursor)
      parts.push({ text: window.slice(cursor, index), hit: false });
    parts.push({ text: match[0], hit: true });
    cursor = index + match[0].length;
  }
  if (cursor < window.length)
    parts.push({ text: window.slice(cursor), hit: false });
  if (end < text.length) parts.push({ text: "…", hit: false });
  return parts;
}
