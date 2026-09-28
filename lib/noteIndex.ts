import "server-only";
import type { NoteLocation } from "@/types/note";

type IndexData = Record<string, NoteLocation>;

const DEFAULT_REPO = process.env.NOTES_REPO_NAME ?? "";

/**
 * Stub — real persistence (e.g. an index file committed to the notes repo,
 * or a small database) comes later. An empty index means every note falls
 * back to the default repo/path convention in getNoteLocation().
 */
async function loadIndex(): Promise<IndexData> {
  return {};
}

/** Stub — no-op until persistence is implemented. */
async function saveIndex(_index: IndexData): Promise<void> {}

/**
 * Resolves where a note actually lives. Every other module must call this
 * (or registerNote/repoForNewNote below) instead of hardcoding a repo name,
 * so that sharding notes across multiple repos later only requires changing
 * this file.
 */
export async function getNoteLocation(noteId: string): Promise<NoteLocation> {
  const index = await loadIndex();
  return index[noteId] ?? { repo: DEFAULT_REPO, path: `notes/${noteId}.md` };
}

export async function registerNote(
  noteId: string,
  location: NoteLocation,
): Promise<void> {
  const index = await loadIndex();
  index[noteId] = location;
  await saveIndex(index);
}

/**
 * The ONLY place the rollover rule (which repo a brand-new note goes into)
 * should live. For now there is a single configured repo; a future version
 * can inspect the loaded index (e.g. per-repo note counts) to decide when
 * to roll over to a new shard.
 */
export async function repoForNewNote(): Promise<string> {
  return DEFAULT_REPO;
}
