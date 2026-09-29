import "server-only";
import matter from "gray-matter";
import { revalidateTag } from "next/cache";
import {
  getNotesRepoConfig,
  getWriteOctokit,
  hasGithubConfig,
} from "@/lib/github";
import {
  getNoteLocation,
  registerNote,
  repoForNewNote,
  unregisterNote,
} from "@/lib/noteIndex";
import {
  normalizeNotebook,
  noteIdFor,
  notePathFor,
  slugify,
  validateNoteId,
} from "@/lib/note-paths";
import { NOTES_TAG } from "@/lib/notes";

// ---------------------------------------------------------------------------
// Errors — every failure maps to a distinct, client-usable code.
// ---------------------------------------------------------------------------

export type WriteErrorCode =
  | "validation"
  | "conflict"
  | "not_found"
  | "github_auth"
  | "rate_limited"
  | "not_configured"
  | "github_error"
  | "internal";

export class WriteError extends Error {
  constructor(
    readonly code: WriteErrorCode,
    message: string,
    readonly status: number,
    readonly resetAt?: string,
  ) {
    super(message);
  }
}

const validation = (message: string) =>
  new WriteError("validation", message, 400);

interface GitHubRequestError {
  status: number;
  message: string;
  response?: {
    headers?: Record<string, string | number | undefined>;
    data?: unknown;
  };
}

function isGitHubRequestError(error: unknown): error is GitHubRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

function header(error: GitHubRequestError, name: string): string | undefined {
  const value = error.response?.headers?.[name];
  return value === undefined ? undefined : String(value);
}

/** Translates an Octokit failure into a WriteError. The raw error is always
 * logged server-side first — nothing is swallowed. */
function toWriteError(
  error: unknown,
  operation: "create" | "update" | "delete" | "read",
): WriteError {
  console.error(`[note-writer] GitHub ${operation} failed:`, error);

  if (!isGitHubRequestError(error)) {
    return new WriteError(
      "internal",
      "Unexpected server error while talking to GitHub.",
      500,
    );
  }

  const { status } = error;
  const data = error.response?.data as { message?: string } | undefined;
  const ghMessage = data?.message ?? error.message ?? "";

  // Primary rate limit: GitHub sends the reset time as a Unix timestamp.
  if (
    (status === 403 || status === 429) &&
    header(error, "x-ratelimit-remaining") === "0"
  ) {
    const reset = Number(header(error, "x-ratelimit-reset"));
    const resetAt = Number.isFinite(reset)
      ? new Date(reset * 1000).toISOString()
      : undefined;
    return new WriteError(
      "rate_limited",
      "GitHub's API rate limit for this token is used up.",
      429,
      resetAt,
    );
  }
  // Secondary (abuse) rate limit: Retry-After in seconds.
  if (
    status === 429 ||
    (status === 403 && /secondary rate limit/i.test(ghMessage))
  ) {
    const retryAfter = Number(header(error, "retry-after"));
    const resetAt = Number.isFinite(retryAfter)
      ? new Date(Date.now() + retryAfter * 1000).toISOString()
      : undefined;
    return new WriteError(
      "rate_limited",
      "GitHub is temporarily limiting requests from this token.",
      429,
      resetAt,
    );
  }
  if (status === 409 || (status === 422 && /sha/i.test(ghMessage))) {
    return operation === "create"
      ? new WriteError(
          "conflict",
          "A note was created at this path at the same moment. Save again to pick a new name.",
          409,
        )
      : new WriteError(
          "conflict",
          "This note changed elsewhere since you opened it.",
          409,
        );
  }
  if (status === 401) {
    return new WriteError(
      "github_auth",
      "GitHub rejected the access token (GITHUB_PAT). It may be expired or revoked.",
      502,
    );
  }
  if (status === 403) {
    return new WriteError(
      "github_auth",
      "The access token (GITHUB_PAT) isn't allowed to write to the notes repo. It needs Contents: read and write.",
      502,
    );
  }
  if (status === 404) {
    return new WriteError(
      "not_found",
      "This note no longer exists — it was deleted or moved elsewhere (or the token can't see the repo).",
      404,
    );
  }
  return new WriteError(
    "github_error",
    `GitHub returned an error (${status}): ${ghMessage}`,
    502,
  );
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const MAX_TITLE = 200;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_MESSAGE = 500;
const SHA_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

function hasControlChars(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function readTitle(value: unknown): string {
  if (typeof value !== "string") throw validation("Title is required.");
  const title = value.trim();
  if (!title) throw validation("Title can't be empty.");
  if (title.length > MAX_TITLE) {
    throw validation(`Title must be ${MAX_TITLE} characters or fewer.`);
  }
  if (hasControlChars(title)) {
    throw validation("Title can't contain line breaks or control characters.");
  }
  return title;
}

function readTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw validation("Tags must be a list.");
  if (value.length > MAX_TAGS) {
    throw validation(`A note can have at most ${MAX_TAGS} tags.`);
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") throw validation("Each tag must be text.");
    const tag = item.trim().replace(/^#/, "");
    if (!tag) throw validation("Tags can't be empty.");
    if (tag.length > MAX_TAG_LENGTH) {
      throw validation(`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`);
    }
    if (/[,[\]{}]/.test(tag) || hasControlChars(tag)) {
      throw validation(`Tag "${tag}" contains characters that aren't allowed.`);
    }
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

function readBody(value: unknown): string {
  if (typeof value !== "string") throw validation("Note content is missing.");
  if (Buffer.byteLength(value, "utf8") > MAX_BODY_BYTES) {
    throw validation("Note is too large (512 KB max).");
  }
  return value;
}

function readMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw validation("Commit message can't be empty.");
  }
  const message = value.trim();
  if (message.length > MAX_MESSAGE) {
    throw validation(
      `Commit message must be ${MAX_MESSAGE} characters or fewer.`,
    );
  }
  return message;
}

function readSha(value: unknown): string {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
    throw validation(
      "Missing or malformed version (sha). Reload the note and try again.",
    );
  }
  return value;
}

function readNotebook(value: unknown): string {
  if (value !== undefined && typeof value !== "string") {
    throw validation("Notebook must be text.");
  }
  const result = normalizeNotebook(value ?? "");
  if (!result.ok) throw validation(result.error);
  return result.value;
}

export function readNoteId(id: string): string {
  const result = validateNoteId(id);
  if (!result.ok) throw validation(result.error);
  return result.value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw validation("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Frontmatter — hand-serialized so an update changes only the keys the
// editor owns (title, tags). Everything else — date, pinned, and any keys
// this app doesn't know about — is written back as it was, in its original
// order, and date-only dates stay date-only.
// ---------------------------------------------------------------------------

const PLAIN_SCALAR = /^[A-Za-z_][A-Za-z0-9 _.,()'!?&/-]*$/;
const PLAIN_FLOW_ITEM = /^[A-Za-z_][A-Za-z0-9 _.()'!?&/-]*$/;
const YAML_KEYWORDS = /^(?:true|false|yes|no|on|off|null|~)$/i;

function yamlString(value: string, pattern: RegExp): string {
  const plain =
    pattern.test(value) && !YAML_KEYWORDS.test(value) && value === value.trim();
  return plain ? value : JSON.stringify(value);
}

function yamlValue(value: unknown): string {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof value === "string") return yamlString(value, PLAIN_SCALAR);
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (value === null) return "null";
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return `[${value.map((v) => yamlString(v, PLAIN_FLOW_ITEM)).join(", ")}]`;
  }
  // Anything structured we don't manage: JSON is valid YAML flow syntax.
  return JSON.stringify(value);
}

function serializeFrontmatter(entries: [string, unknown][]): string {
  return entries
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join("\n");
}

function buildFile(
  entries: [string, unknown][],
  body: string,
  lineEnding: "\n" | "\r\n",
): string {
  const file = `---\n${serializeFrontmatter(entries)}\n---\n\n${body.trim()}\n`;
  return lineEnding === "\r\n" ? file.replace(/\n/g, "\r\n") : file;
}

function todayDate(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function mergeFrontmatter(
  existing: Record<string, unknown>,
  updates: { title: string; tags: string[] },
): [string, unknown][] {
  const entries: [string, unknown][] = Object.entries(existing).map(
    ([key, value]) =>
      key === "title"
        ? [key, updates.title]
        : key === "tags"
          ? [key, updates.tags]
          : [key, value],
  );
  const keys = new Set(Object.keys(existing));
  if (!keys.has("title")) entries.unshift(["title", updates.title]);
  // Notes without a date get one on their first save, so their listed date
  // stops drifting to "now" on every read.
  if (!keys.has("date")) entries.splice(1, 0, ["date", todayDate()]);
  if (!keys.has("tags")) entries.push(["tags", updates.tags]);
  return entries;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function ensureConfigured() {
  if (!hasGithubConfig()) {
    throw new WriteError(
      "not_configured",
      "Saving needs GITHUB_PAT, NOTES_REPO_OWNER and NOTES_REPO_NAME to be set.",
      503,
    );
  }
}

function encode(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

function revalidateNotes() {
  revalidateTag(NOTES_TAG, { expire: 0 });
}

async function readCurrentFile(
  repo: string,
  path: string,
): Promise<{ sha: string; raw: string } | null> {
  const octokit = getWriteOctokit();
  const { owner } = getNotesRepoConfig();
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return {
      sha: data.sha,
      raw: Buffer.from(data.content, "base64").toString("utf8"),
    };
  } catch (error) {
    if (isGitHubRequestError(error) && error.status === 404) return null;
    throw toWriteError(error, "read");
  }
}

const MAX_SUFFIX = 50;

export async function createNote(
  input: unknown,
): Promise<{ id: string; sha: string }> {
  ensureConfigured();
  const body = asRecord(input);
  const title = readTitle(body.title);
  const notebook = readNotebook(body.notebook);
  const tags = readTags(body.tags);
  const markdown = readBody(body.content);
  const message = readMessage(body.message);

  const repo = await repoForNewNote();
  const baseSlug = slugify(title) || "note";

  for (let n = 1; n <= MAX_SUFFIX; n++) {
    const id = noteIdFor(notebook, n === 1 ? baseSlug : `${baseSlug}-${n}`);

    // Taken if the index maps this id anywhere, or a file already sits at
    // the path in the repo new notes go to.
    const location = await getNoteLocation(id);
    const taken =
      (await readCurrentFile(location.repo, location.path)) !== null ||
      (location.repo !== repo &&
        (await readCurrentFile(repo, notePathFor(id))) !== null);
    if (taken) continue;

    const path = notePathFor(id);
    const file = buildFile(
      [
        ["title", title],
        ["date", todayDate()],
        ["tags", tags],
      ],
      markdown,
      "\n",
    );

    const octokit = getWriteOctokit();
    const { owner } = getNotesRepoConfig();
    let sha: string;
    try {
      // No `sha`: GitHub then refuses (422) rather than overwrite if a file
      // appeared at this path after the existence check above.
      const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: encode(file),
      });
      sha = data.content?.sha ?? "";
    } catch (error) {
      throw toWriteError(error, "create");
    }

    await registerNote(id, { repo, path, sha });
    revalidateNotes();
    return { id, sha };
  }

  throw validation(
    `There are already ${MAX_SUFFIX} notes with this title in this notebook. Choose a different title.`,
  );
}

export async function updateNote(
  rawId: string,
  input: unknown,
): Promise<{ id: string; sha: string }> {
  ensureConfigured();
  const id = readNoteId(rawId);
  const body = asRecord(input);
  const title = readTitle(body.title);
  const tags = readTags(body.tags);
  const markdown = readBody(body.content);
  const message = readMessage(body.message);
  const sha = readSha(body.sha);
  if (body.notebook !== undefined) {
    throw validation(
      "Moving a note to another notebook isn't supported yet. Create a new note instead.",
    );
  }

  const location = await getNoteLocation(id);
  const current = await readCurrentFile(location.repo, location.path);
  if (!current) {
    revalidateNotes();
    throw new WriteError(
      "not_found",
      "This note no longer exists — it was deleted or moved elsewhere.",
      404,
    );
  }
  // Checked here for a clear early answer; GitHub enforces the same sha on
  // the write below, which also covers a change landing in between.
  if (current.sha !== sha) {
    revalidateNotes();
    throw new WriteError(
      "conflict",
      "This note changed elsewhere since you opened it.",
      409,
    );
  }

  const existing = matter(current.raw).data as Record<string, unknown>;
  const file = buildFile(
    mergeFrontmatter(existing, { title, tags }),
    markdown,
    current.raw.includes("\r\n") ? "\r\n" : "\n",
  );

  const octokit = getWriteOctokit();
  const { owner } = getNotesRepoConfig();
  let newSha: string;
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: location.repo,
      path: location.path,
      message,
      content: encode(file),
      sha,
    });
    newSha = data.content?.sha ?? "";
  } catch (error) {
    const writeError = toWriteError(error, "update");
    if (writeError.code === "conflict" || writeError.code === "not_found") {
      revalidateNotes();
    }
    throw writeError;
  }

  await registerNote(id, { ...location, sha: newSha });
  revalidateNotes();
  return { id, sha: newSha };
}

export async function deleteNote(rawId: string, input: unknown): Promise<void> {
  ensureConfigured();
  const id = readNoteId(rawId);
  const body = asRecord(input ?? {});
  const sha = readSha(body.sha);
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE)
      : id;

  const location = await getNoteLocation(id);
  const octokit = getWriteOctokit();
  const { owner } = getNotesRepoConfig();
  try {
    await octokit.rest.repos.deleteFile({
      owner,
      repo: location.repo,
      path: location.path,
      message: `Delete: ${title}`,
      sha,
    });
  } catch (error) {
    const writeError = toWriteError(error, "delete");
    if (writeError.code === "conflict" || writeError.code === "not_found") {
      revalidateNotes();
    }
    throw writeError;
  }

  await unregisterNote(id);
  revalidateNotes();
}
