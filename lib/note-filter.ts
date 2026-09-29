import type MiniSearch from "minisearch";
import type { SearchOptions } from "minisearch";
import type { NoteMeta } from "@/types/note";

export type DatePreset = "any" | "today" | "7d" | "30d" | "year" | "custom";
export type SortKey = "newest" | "oldest" | "title-asc" | "title-desc";

export interface NoteFilterState {
  query: string;
  /** Notebook path; matches that notebook and all of its descendants. */
  notebook: string | null;
  /** A note matches if it has ANY of these tags. */
  tags: string[];
  date: DatePreset;
  /** YYYY-MM-DD, only used when date === "custom". Empty = unbounded. */
  from: string;
  to: string;
  sort: SortKey;
}

export const DEFAULT_FILTER_STATE: NoteFilterState = {
  query: "",
  notebook: null,
  tags: [],
  date: "any",
  from: "",
  to: "",
  sort: "newest",
};

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

// ---------------------------------------------------------------------------
// Search — produces hits; filterAndSortNotes() then intersects them with the
// notebook/tag/date filters and orders them.
// ---------------------------------------------------------------------------

export interface SearchHit {
  /** Relevance score. Absent for the substring fallback, which can't rank —
   * results then keep the selected sort. */
  score?: number;
  /** Matched document terms -> the fields each matched in (e.g. "body"). */
  match: Record<string, string[]>;
}

/** Hits keyed by note id, in relevance order (Map preserves insertion order).
 * The query passed in is already trimmed and non-empty. */
export type NoteSearch = (
  notes: readonly NoteMeta[],
  query: string,
) => ReadonlyMap<string, SearchHit>;

/**
 * FALLBACK ONLY — used while the full-text index is still loading, or if it
 * failed to load, so search keeps working instead of breaking. It can't see
 * note bodies and can't rank: case-insensitive; every whitespace-separated
 * term must appear somewhere in the title, tags, notebook or excerpt.
 */
export const substringSearch: NoteSearch = (notes, query) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = new Map<string, SearchHit>();
  for (const note of notes) {
    const haystack = [
      note.title,
      note.tags.join(" "),
      note.notebook,
      note.excerpt,
    ]
      .join("\n")
      .toLowerCase();
    if (terms.every((term) => haystack.includes(term))) {
      hits.set(note.id, { match: {} });
    }
  }
  return hits;
};

/** Full-text search over a loaded MiniSearch index (title, tags, notebook
 * and the whole body), ranked by relevance. */
export function createIndexSearch(
  index: MiniSearch,
  options: SearchOptions,
): NoteSearch {
  return (_notes, query) => {
    const hits = new Map<string, SearchHit>();
    for (const result of index.search(query, options)) {
      hits.set(String(result.id), { score: result.score, match: result.match });
    }
    return hits;
  };
}

/** The matched terms that appear in the body but not the title — i.e. what
 * a snippet would show that the title doesn't. Empty = no snippet needed. */
export function bodyOnlyTerms(hit: SearchHit | undefined): string[] {
  if (!hit) return [];
  return Object.entries(hit.match)
    .filter(
      ([, fields]) => fields.includes("body") && !fields.includes("title"),
    )
    .map(([term]) => term);
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function notebookMatches(
  noteNotebook: string,
  selected: string,
): boolean {
  return noteNotebook === selected || noteNotebook.startsWith(`${selected}/`);
}

/** Notebook, tags and date — deliberately NOT search text or sort. */
export function hasActiveFilters(state: NoteFilterState): boolean {
  return (
    state.notebook !== null || state.tags.length > 0 || isDateActive(state)
  );
}

export function isDateActive(state: NoteFilterState): boolean {
  if (state.date === "custom") return Boolean(state.from || state.to);
  return state.date !== "any";
}

/** Badge count for the filter popover: each selected tag, an active date
 * range, and a non-default sort each count as one. */
export function countPopoverFilters(state: NoteFilterState): number {
  return (
    state.tags.length +
    (isDateActive(state) ? 1 : 0) +
    (state.sort !== DEFAULT_FILTER_STATE.sort ? 1 : 0)
  );
}

export function isDefaultState(state: NoteFilterState): boolean {
  return (
    !state.query.trim() &&
    !hasActiveFilters(state) &&
    state.sort === DEFAULT_FILTER_STATE.sort
  );
}

// ---------------------------------------------------------------------------
// Dates — compared as YYYY-MM-DD calendar days. A note's day is the UTC date
// of its ISO timestamp (frontmatter dates are date-only, stored as UTC
// midnight); "today" is the viewer's local calendar day.
// ---------------------------------------------------------------------------

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateRange(
  state: NoteFilterState,
  today: string,
): [string, string] | null {
  switch (state.date) {
    case "today":
      return [today, today];
    case "7d":
      return [addDays(today, -6), today];
    case "30d":
      return [addDays(today, -29), today];
    case "year":
      return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`];
    case "custom": {
      if (!state.from && !state.to) return null;
      const from = state.from || "0000-01-01";
      const to = state.to || "9999-12-31";
      return from <= to ? [from, to] : [to, from];
    }
    default:
      return null;
  }
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Deterministic across server and client (fixed locale + UTC), so it's
 * safe to render during SSR without a hydration mismatch. */
export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayFormatter.format(date);
}

export function dateFilterLabel(state: NoteFilterState): string {
  if (state.date !== "custom") {
    return DATE_PRESETS.find((p) => p.value === state.date)?.label ?? "";
  }
  const from = state.from ? formatNoteDate(`${state.from}T00:00:00Z`) : "";
  const to = state.to ? formatNoteDate(`${state.to}T00:00:00Z`) : "";
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

// ---------------------------------------------------------------------------
// Filter + sort
// ---------------------------------------------------------------------------

const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compare(a: NoteMeta, b: NoteMeta, sort: SortKey): number {
  switch (sort) {
    case "oldest":
      return a.date.localeCompare(b.date) || collator.compare(a.title, b.title);
    case "title-asc":
      return collator.compare(a.title, b.title) || b.date.localeCompare(a.date);
    case "title-desc":
      return collator.compare(b.title, a.title) || b.date.localeCompare(a.date);
    default:
      return b.date.localeCompare(a.date) || collator.compare(a.title, b.title);
  }
}

/**
 * Pinned rule: pinned notes float to the top only while the sort is the
 * default AND no notebook/tag/date filter is applied. Search text alone does
 * not disable floating. Otherwise pinned notes sort like any other note.
 */
export function shouldFloatPinned(state: NoteFilterState): boolean {
  return state.sort === DEFAULT_FILTER_STATE.sort && !hasActiveFilters(state);
}

/**
 * Search + sort rule, in one place:
 * - Relevance order applies when there's a search query, the index could
 *   rank it (not the substring fallback), AND the sort is the default
 *   ("Newest first"). The default sort means "no preference", so relevance
 *   wins over date.
 * - An explicitly chosen sort (Oldest, Title A–Z/Z–A) always wins over
 *   relevance — search then only filters.
 * - Pinned floating is unchanged and applies first: it's on only with the
 *   default sort and no notebook/tag/date filter. Search text alone doesn't
 *   cancel it, so matching pinned notes float, then relevance order.
 */
export function usesRelevanceOrder(
  state: NoteFilterState,
  hits: ReadonlyMap<string, SearchHit> | null,
): boolean {
  if (!hits || state.sort !== DEFAULT_FILTER_STATE.sort) return false;
  const first = hits.values().next().value;
  return first?.score !== undefined;
}

export function searchNotes(
  notes: readonly NoteMeta[],
  query: string,
  search: NoteSearch = substringSearch,
): ReadonlyMap<string, SearchHit> | null {
  const trimmed = query.trim();
  return trimmed ? search(notes, trimmed) : null;
}

export function filterAndSortNotes(
  notes: readonly NoteMeta[],
  state: NoteFilterState,
  options: {
    today: string;
    /** Precomputed hits (from searchNotes), so callers that also need them
     * for snippets don't search twice. */
    hits?: ReadonlyMap<string, SearchHit> | null;
    search?: NoteSearch;
  },
): NoteMeta[] {
  const searchHits =
    options.hits !== undefined
      ? options.hits
      : searchNotes(notes, state.query, options.search);
  const range = dateRange(state, options.today);
  const tagSet = state.tags.length ? new Set(state.tags) : null;

  const result = notes.filter((note) => {
    if (searchHits && !searchHits.has(note.id)) return false;
    if (state.notebook && !notebookMatches(note.notebook, state.notebook)) {
      return false;
    }
    if (tagSet && !note.tags.some((tag) => tagSet.has(tag))) return false;
    if (range) {
      const day = note.date.slice(0, 10);
      if (day < range[0] || day > range[1]) return false;
    }
    return true;
  });

  const floatPinned = shouldFloatPinned(state);
  const byRelevance = usesRelevanceOrder(state, searchHits);
  const score = (note: NoteMeta) => searchHits?.get(note.id)?.score ?? 0;
  return result.sort(
    (a, b) =>
      (floatPinned ? Number(b.pinned) - Number(a.pinned) : 0) ||
      (byRelevance ? score(b) - score(a) : 0) ||
      compare(a, b, state.sort),
  );
}

// ---------------------------------------------------------------------------
// URL (de)serialization — defaults are omitted to keep URLs short.
// Params: q, nb, tag (repeated), date, from, to, sort.
// ---------------------------------------------------------------------------

interface ReadableParams {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export function parseFilterState(params: ReadableParams): NoteFilterState {
  const date = params.get("date");
  const sort = params.get("sort");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const validDate = DATE_PRESETS.some((p) => p.value === date)
    ? (date as DatePreset)
    : "any";

  return {
    query: params.get("q") ?? "",
    notebook: params.get("nb") || null,
    tags: Array.from(new Set(params.getAll("tag").filter(Boolean))),
    date: validDate,
    from: validDate === "custom" && DAY_PATTERN.test(from) ? from : "",
    to: validDate === "custom" && DAY_PATTERN.test(to) ? to : "",
    sort: SORT_OPTIONS.some((o) => o.value === sort)
      ? (sort as SortKey)
      : DEFAULT_FILTER_STATE.sort,
  };
}

export function serializeFilterState(state: NoteFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.notebook) params.set("nb", state.notebook);
  for (const tag of state.tags) params.append("tag", tag);
  if (state.date !== "any") params.set("date", state.date);
  if (state.date === "custom") {
    if (state.from) params.set("from", state.from);
    if (state.to) params.set("to", state.to);
  }
  if (state.sort !== DEFAULT_FILTER_STATE.sort) params.set("sort", state.sort);
  return params;
}
