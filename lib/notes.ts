import "server-only";
import matter from "gray-matter";
import { unstable_cache } from "next/cache";
import { getNotesRepoConfig, getOctokit, hasGithubConfig } from "@/lib/github";
import { getNoteLocation } from "@/lib/noteIndex";
import type { Note, NoteMeta, NotebookSummary, TagSummary } from "@/types/note";

/** Single tag all note reads are cached under — revalidate this to pick up
 * changes (see app/api/revalidate/route.ts). */
export const NOTES_TAG = "notes";

const UNCATEGORIZED = "uncategorized";
const EXCERPT_LENGTH = 160;
const BLOB_CONCURRENCY = 8;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function deriveIdAndNotebook(path: string): { id: string; notebook: string } {
  const id = path.replace(/^notes\//, "").replace(/\.md$/, "");
  const slashIndex = id.lastIndexOf("/");
  const notebook = slashIndex === -1 ? UNCATEGORIZED : id.slice(0, slashIndex);
  return { id, notebook };
}

function humanizeSegment(segment: string): string {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeTitle(id: string): string {
  const filename = id.split("/").pop() ?? id;
  return humanizeSegment(filename);
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeExcerpt(body: string): string {
  const plain = stripMarkdown(body);
  if (plain.length <= EXCERPT_LENGTH) return plain;
  return plain.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, "") + "…";
}

/**
 * Parses one note file's raw contents (frontmatter + body) into a Note.
 *
 * Fallbacks, as documented in the task: title falls back to a humanized
 * filename; tags default to []. Date falls back to the current time rather
 * than the file's first commit — fetching commit history would cost one
 * extra GitHub API request per undated note, which we'd rather not pay for
 * on every listNotes() call. Document dates in frontmatter to avoid this.
 */
function parseNoteFile(path: string, raw: string, sha: string): Note {
  const { id, notebook } = deriveIdAndNotebook(path);
  const { data, content } = matter(raw);

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : humanizeTitle(id);

  let date: string;
  if (data.date instanceof Date && !Number.isNaN(data.date.getTime())) {
    date = data.date.toISOString();
  } else if (
    typeof data.date === "string" &&
    !Number.isNaN(Date.parse(data.date))
  ) {
    date = new Date(data.date).toISOString();
  } else {
    date = new Date().toISOString();
  }

  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  const pinned = data.pinned === true;
  const trimmedContent = content.trim();

  return {
    id,
    notebook,
    title,
    date,
    tags,
    pinned,
    sha,
    excerpt: makeExcerpt(trimmedContent),
    content: trimmedContent,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

// ---------------------------------------------------------------------------
// Dev fallback data — used whenever GitHub env vars aren't configured, so UI
// work can proceed without a real notes repo.
// ---------------------------------------------------------------------------

const SAMPLE_NOTE_SOURCES: {
  id: string;
  title: string;
  date: string;
  tags: string[];
  pinned: boolean;
  content: string;
}[] = [
  {
    id: "project-ideas/startup-x",
    title: "Startup X — early sketch",
    date: "2025-03-02T00:00:00.000Z",
    tags: ["ideas", "business"],
    pinned: true,
    content: `A rough sketch of an idea: a subscription box for indoor plant
cuttings, shipped with a care card and a small pot. The interesting part
isn't the plants — it's the onboarding flow that teaches new plant owners
enough to not kill the thing in week one.

Open questions:

- Is the margin on shipping soil-adjacent products actually workable?
- Would a "plant sitter" video-call add-on be a gimmick or a real feature?

Next step: talk to three people who've killed a houseplant in the last year
and ask what they wish they'd known.`,
  },
  {
    id: "journal/2025-01-04",
    title: "Morning pages",
    date: "2025-01-04T07:15:00.000Z",
    tags: ["journal", "reflection"],
    pinned: false,
    content: `First proper morning pages of the year. Slept badly, but the
walk helped. Noticing that the days I write something — anything — before
opening a laptop are the days I actually remember by the evening.

Trying a rule for this year: no screens before the first page is full.`,
  },
  {
    id: "engineering/caching-notes",
    title: "Notes on Next.js caching",
    date: "2025-06-18T00:00:00.000Z",
    tags: ["nextjs", "caching", "reference"],
    pinned: false,
    content: `Next.js 16 without Cache Components still uses the "previous
model": \`unstable_cache\` for non-\`fetch\` data sources, tagged so it can be
invalidated on demand.

\`\`\`ts
export const getData = unstable_cache(
  async () => fetchFromSomewhere(),
  ["cache-key"],
  { tags: ["notes"], revalidate: false },
);
\`\`\`

Then, from a webhook or route handler:

\`\`\`ts
revalidateTag("notes", { expire: 0 });
\`\`\`

The second argument to \`revalidateTag\` is required as of this version —
omitting it is deprecated and behaves like \`{ expire: 0 }\` anyway.`,
  },
  {
    id: "reading-list",
    title: "Reading list",
    date: "2024-11-20T00:00:00.000Z",
    tags: ["books"],
    pinned: false,
    content: `Books I want to get to, roughly in order.

| Title                    | Author           | Status      |
| ------------------------- | ---------------- | ----------- |
| Seeing Like a State       | James C. Scott    | Reading     |
| The Timeless Way of Building | Christopher Alexander | Not started |
| A Pattern Language        | Christopher Alexander | Not started |
| Exhalation                | Ted Chiang        | Finished    |

Exhalation was worth the hype — "The Merchant and the Alchemist's Gate" in
particular.`,
  },
];

const SAMPLE_NOTES: Note[] = SAMPLE_NOTE_SOURCES.map((source) => {
  const { notebook } = deriveIdAndNotebook(`notes/${source.id}.md`);
  return {
    id: source.id,
    notebook,
    title: source.title,
    date: source.date,
    tags: source.tags,
    pinned: source.pinned,
    sha: `sample-${source.id}`,
    excerpt: makeExcerpt(source.content),
    content: source.content.trim(),
  };
});

function warnFallback(): void {
  console.warn(
    "[lib/notes] GitHub env vars not set — serving built-in sample notes. " +
      "Set GITHUB_PAT, NOTES_REPO_OWNER and NOTES_REPO_NAME in .env.local " +
      "(see .env.local.example) to read your real notes repo.",
  );
}

// ---------------------------------------------------------------------------
// GitHub-backed reads
// ---------------------------------------------------------------------------

async function fetchAllNotesFromGitHub(): Promise<Note[]> {
  const octokit = getOctokit();
  const { owner, repo } = getNotesRepoConfig();

  // The Git Trees API needs a real branch/tag name or SHA (no "default
  // branch" shorthand), so we look it up first.
  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const branch = repoInfo.default_branch;

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "true",
  });

  if (tree.truncated) {
    console.warn(
      `[lib/notes] Git tree for ${owner}/${repo}@${branch} was truncated by ` +
        `GitHub (repo has too many entries for a single response). Returning ` +
        `the ${tree.tree.length} entries GitHub did return; some notes under ` +
        `notes/ may be missing. A recursive per-directory walk would avoid ` +
        `this but costs many more API requests — not implemented.`,
    );
  }

  const mdFiles = tree.tree.filter(
    (entry): entry is typeof entry & { path: string; sha: string } =>
      entry.type === "blob" &&
      typeof entry.path === "string" &&
      entry.path.startsWith("notes/") &&
      entry.path.endsWith(".md") &&
      typeof entry.sha === "string",
  );

  return mapWithConcurrency(mdFiles, BLOB_CONCURRENCY, async (entry) => {
    const { data: blob } = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: entry.sha,
    });
    const raw = Buffer.from(blob.content, "base64").toString("utf-8");
    // A tree entry's sha is the blob sha — the same value the contents API
    // requires to update or delete the file.
    return parseNoteFile(entry.path, raw, entry.sha);
  });
}

async function fetchOneNoteFromGitHub(id: string): Promise<Note | null> {
  const location = await getNoteLocation(id);
  const octokit = getOctokit();
  const { owner } = getNotesRepoConfig();

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: location.repo,
      path: location.path,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }

    const raw = Buffer.from(data.content, "base64").toString("utf-8");
    return parseNoteFile(location.path, raw, data.sha);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public API — cached under NOTES_TAG, indefinitely, until revalidated.
// ---------------------------------------------------------------------------

const getCachedNotes = unstable_cache(
  async (): Promise<Note[]> => {
    if (!hasGithubConfig()) {
      warnFallback();
      return SAMPLE_NOTES;
    }
    return fetchAllNotesFromGitHub();
  },
  // "v2": entries cached before notes carried a `sha` must never be served
  // to code that relies on it (the data cache can outlive a deploy).
  ["notes", "listNotes", "v2"],
  { tags: [NOTES_TAG], revalidate: false },
);

export async function listNotes(): Promise<NoteMeta[]> {
  const notes = await getCachedNotes();
  return notes.map(({ content: _content, ...meta }) => meta);
}

/** Uncached: always GitHub's current version. The editor loads through
 * this so the sha it later sends back reflects the real file, not a
 * cached copy that may predate an edit made directly on GitHub. */
export async function getNoteFresh(id: string): Promise<Note | null> {
  if (!hasGithubConfig()) {
    warnFallback();
    return SAMPLE_NOTES.find((note) => note.id === id) ?? null;
  }
  return fetchOneNoteFromGitHub(id);
}

export const getNote = unstable_cache(
  async (id: string): Promise<Note | null> => getNoteFresh(id),
  ["notes", "getNote", "v2"],
  { tags: [NOTES_TAG], revalidate: false },
);

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const notes = await listNotes();
  const counts = new Map<string, number>();
  for (const note of notes) {
    counts.set(note.notebook, (counts.get(note.notebook) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([path, count]) => ({
      name: humanizeSegment(path.split("/").pop() ?? path),
      path,
      count,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function listTags(): Promise<TagSummary[]> {
  const notes = await listNotes();
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
