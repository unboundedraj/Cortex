import { FileWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteEditorForm } from "@/components/note-editor-form";
import { SiteHeader } from "@/components/site-header";
import { checkEditorFidelity } from "@/lib/editor-fidelity";
import { validateNoteId } from "@/lib/note-paths";
import { getNoteFresh, listNotebooks, listTags } from "@/lib/notes";
import { decodeNoteId, noteHref } from "@/lib/routes";

async function loadNote(segments: string[]) {
  const id = decodeNoteId(segments);
  if (!validateNoteId(id).ok) return null;
  // Uncached on purpose: the sha sent back on save must be GitHub's
  // current one, not a cached copy that predates an edit made elsewhere.
  return getNoteFresh(id);
}

export async function generateMetadata({
  params,
}: PageProps<"/edit/[...id]">): Promise<Metadata> {
  const note = await loadNote((await params).id);
  return {
    title: note ? `Edit: ${note.title} · Cortex` : "Edit note · Cortex",
  };
}

export default async function EditNotePage({
  params,
}: PageProps<"/edit/[...id]">) {
  const note = await loadNote((await params).id);
  if (!note) notFound();

  const fidelity = checkEditorFidelity(note.content);
  const [notebooks, tags] = await Promise.all([listNotebooks(), listTags()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wordmark="link" />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {!fidelity.faithful && !fidelity.parseable ? (
            // Refuse rather than risk it: if the editor can't even load the
            // note, saving from it would lose content.
            <div className="border-border bg-surface mx-auto max-w-lg rounded-2xl border p-6 text-center">
              <FileWarning
                className="text-danger mx-auto h-6 w-6"
                aria-hidden="true"
              />
              <h1 className="mt-3 text-lg font-semibold">
                This note can&apos;t be opened in the editor
              </h1>
              <p className="text-muted mt-2 text-sm">
                It contains markdown the editor can&apos;t represent, so editing
                it here would lose content. Edit the file directly on GitHub
                instead.
              </p>
              <Link
                href={noteHref(note.id)}
                className="border-border hover:bg-surface-hover mt-5 inline-flex h-11 items-center rounded-xl border px-4 text-sm font-medium"
              >
                Back to the note
              </Link>
            </div>
          ) : (
            <NoteEditorForm
              mode="edit"
              note={{
                id: note.id,
                title: note.title,
                notebook:
                  note.notebook === "uncategorized" ? "" : note.notebook,
                tags: note.tags,
                content: note.content,
                sha: note.sha,
              }}
              fidelity={fidelity}
              notebooks={notebooks}
              tagSuggestions={tags.map((t) => t.tag)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
