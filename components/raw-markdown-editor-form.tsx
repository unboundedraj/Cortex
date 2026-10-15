"use client";

import { Copy, Download, Lock, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { CommitDialog } from "@/components/commit-dialog";
import { TagInput } from "@/components/tag-input";
import {
  callWriteApi,
  describeWriteFailure,
  encodeNoteIdForUrl,
} from "@/lib/notes-client";
import { noteHref } from "@/lib/routes";
import type { NotebookSummary } from "@/types/note";
import type { EditableNote } from "@/components/note-editor-form";

export function RawMarkdownEditorForm({
  note,
  notebooks: _notebooks,
  tagSuggestions,
  reason,
}: {
  note: EditableNote;
  notebooks: NotebookSummary[];
  tagSuggestions: string[];
  reason: string;
}) {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags);
  const [content, setContent] = useState(note.content);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState(`Update: ${note.title}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const titleId = useId();
  const tagsId = useId();
  const titleRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== note.title ||
    !tags.every((tag, index) => tag === note.tags[index]) ||
    tags.length !== note.tags.length ||
    content !== note.content;

  const commit = async () => {
    if (saving) return;
    if (!title.trim()) {
      setError("Give the note a title before saving.");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    const result = await callWriteApi<{ id: string; sha: string }>(
      `/api/notes/${encodeNoteIdForUrl(note.id)}`,
      {
        method: "PUT",
        body: {
          title,
          tags,
          content,
          message: commitMessage,
          sha: note.sha,
        },
      },
    );
    if (result.ok) {
      window.location.assign(noteHref(result.data.id));
      return;
    }
    setSaving(false);
    if (result.error.code === "conflict") {
      setCommitOpen(false);
      setConflict(true);
      return;
    }
    if (result.error.code === "unauthorized") {
      setError(
        "Your session has expired. Sign in again in a new tab, then commit again.",
      );
      return;
    }
    setError(describeWriteFailure(result.error));
  };

  const draftFile = () =>
    `---\ntitle: ${JSON.stringify(title)}\ntags: ${JSON.stringify(tags)}\n---\n\n${content}\n`;
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([draftFile()], { type: "text/markdown" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "note-draft.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={noteHref(note.id)}
          className="text-muted hover:text-foreground hover:bg-surface-hover -ml-2 inline-flex h-11 items-center rounded-lg px-2 text-sm"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            setCommitMessage(`Update: ${title.trim()}`);
            setCommitOpen(true);
          }}
          className="bg-accent text-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save
        </button>
      </div>

      <section
        role="alert"
        className="border-danger/40 bg-surface rounded-2xl border p-4 text-sm"
      >
        <p className="flex items-start gap-2 font-medium">
          <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The rich editor could not load this note. Raw Markdown mode keeps
            the original content.
          </span>
        </p>
        <details className="text-muted mt-2 pl-6 text-xs">
          <summary className="cursor-pointer">Show full diagnostic</summary>
          <pre className="mt-2 max-h-96 overflow-auto font-mono break-words whitespace-pre-wrap">
            {reason}
          </pre>
        </details>
      </section>

      <h1 className="text-2xl font-semibold">Edit as raw Markdown instead</h1>

      {conflict && (
        <section
          role="alert"
          className="border-danger/50 rounded-2xl border p-4"
        >
          <p className="text-danger font-semibold">
            This note changed elsewhere since you opened it.
          </p>
          <p className="text-muted mt-2 text-sm">
            Nothing was overwritten. Keep a copy of your draft, then reload the
            latest version before trying again.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(draftFile())}
              className="border-border inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <Copy className="h-4 w-4" /> Copy draft
            </button>
            <button
              type="button"
              onClick={download}
              className="border-border inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <Download className="h-4 w-4" /> Download draft
            </button>
          </div>
        </section>
      )}

      <input
        ref={titleRef}
        id={titleId}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full bg-transparent text-3xl font-semibold outline-none sm:text-4xl"
        aria-label="Title"
      />
      <div>
        <label className="text-muted mb-1.5 block text-xs font-medium tracking-widest uppercase">
          Notebook
        </label>
        <div className="border-border bg-background text-muted flex h-11 items-center gap-2 rounded-xl border px-3 text-sm">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {note.notebook || "uncategorized"}
        </div>
      </div>
      <div>
        <label
          htmlFor={tagsId}
          className="text-muted mb-1.5 block text-xs font-medium tracking-widest uppercase"
        >
          Tags
        </label>
        <TagInput
          id={tagsId}
          tags={tags}
          suggestions={tagSuggestions}
          onChange={setTags}
        />
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        aria-label="Raw Markdown"
        spellCheck={false}
        className="border-border bg-surface min-h-[32rem] w-full resize-y rounded-2xl border p-4 font-mono text-sm leading-6 outline-none"
      />

      <CommitDialog
        open={commitOpen}
        message={commitMessage}
        onMessageChange={setCommitMessage}
        pending={saving}
        error={error}
        onConfirm={commit}
        onCancel={() => setCommitOpen(false)}
      />
    </div>
  );
}
