"use client";

import type { Editor } from "@tiptap/core";
import {
  Copy,
  Download,
  Lock,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CommitDialog } from "@/components/commit-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LogoutButton } from "@/components/logout-button";
import { NoteEditor, useNoteEditor } from "@/components/note-editor";
import { TagInput } from "@/components/tag-input";
import { docToMarkdown } from "@/lib/editor-extensions";
import type { EditorFidelity } from "@/lib/editor-fidelity";
import {
  normalizeNotebook,
  notePathFor,
  noteIdFor,
  slugify,
} from "@/lib/note-paths";
import {
  callWriteApi,
  describeWriteFailure,
  encodeNoteIdForUrl,
} from "@/lib/notes-client";
import { noteHref } from "@/lib/routes";
import type { NotebookSummary } from "@/types/note";

export interface EditableNote {
  id: string;
  title: string;
  notebook: string;
  tags: string[];
  content: string;
  sha: string;
}

type Props = {
  notebooks: NotebookSummary[];
  tagSuggestions: string[];
} & (
  | { mode: "new" }
  | { mode: "edit"; note: EditableNote; fidelity: EditorFidelity }
);

type ConflictKind = "changed" | "deleted" | null;

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

export function NoteEditorForm(props: Props) {
  const initial =
    props.mode === "edit"
      ? props.note
      : { id: "", title: "", notebook: "", tags: [], content: "", sha: "" };
  const fidelity = props.mode === "edit" ? props.fidelity : null;

  const [title, setTitle] = useState(initial.title);
  const [notebook, setNotebook] = useState(initial.notebook);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [bodyDirty, setBodyDirty] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [fidelityAck, setFidelityAck] = useState(false);

  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictKind>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  const [pendingNav, setPendingNav] = useState<HTMLAnchorElement | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);

  const allowLeaveRef = useRef(false);
  const baselineRef = useRef<string | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const notebookId = useId();
  const tagsId = useId();
  const notebookListId = useId();

  const editor = useNoteEditor(initial.content, (instance: Editor) => {
    if (baselineRef.current === null) return;
    setBodyDirty(docToMarkdown(instance.getJSON()) !== baselineRef.current);
  });

  // Baseline = the editor's own serialization of the loaded note, so an
  // untouched note never reads as "changed" because of formatting quirks.
  useEffect(() => {
    if (editor && baselineRef.current === null) {
      baselineRef.current = docToMarkdown(editor.getJSON());
    }
  }, [editor]);

  const isDirty =
    bodyDirty ||
    title !== initial.title ||
    notebook !== initial.notebook ||
    !sameTags(tags, initial.tags);
  // allowLeaveRef (set once the user confirms leaving, or after a
  // successful save) is checked inside the handlers themselves.
  const guardActive = isDirty || saving;

  const notebookResult = normalizeNotebook(notebook);
  const slugPreview = slugify(title) || "note";

  // --- Unsaved-changes protection -----------------------------------------

  // Tab close, reload, typing a new URL.
  useEffect(() => {
    if (!guardActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [guardActive]);

  // In-app links (header wordmark, Cancel, Back…). Runs in the capture
  // phase so it sees the click before React/Next's own link handlers; the
  // original click is replayed after the user confirms.
  useEffect(() => {
    if (!guardActive) return;
    const onClick = (event: MouseEvent) => {
      if (allowLeaveRef.current || event.defaultPrevented) return;
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.closest(".ProseMirror")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNav(anchor);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [guardActive]);

  const leaveTo = (anchor: HTMLAnchorElement) => {
    allowLeaveRef.current = true;
    setPendingNav(null);
    anchor.click();
  };

  // --- Save flow -----------------------------------------------------------

  const openCommit = useCallback(() => {
    if (!editor || saving) return;
    if (!title.trim()) {
      setTitleError("Give the note a title before saving.");
      titleRef.current?.focus();
      return;
    }
    if (props.mode === "new" && !notebookResult.ok) return;
    if (fidelity && !fidelity.faithful && !fidelityAck) return;
    setTitleError(null);
    setSaveError(null);
    setCommitMessage(
      `${props.mode === "new" ? "Add" : "Update"}: ${title.trim()}`,
    );
    setCommitOpen(true);
  }, [
    editor,
    saving,
    title,
    props.mode,
    notebookResult.ok,
    fidelity,
    fidelityAck,
  ]);

  // Ctrl/Cmd+S opens the commit dialog instead of the browser's "save page".
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        openCommit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openCommit]);

  const commit = async () => {
    if (!editor || saving) return;
    setSaving(true);
    setSaveError(null);
    const content = docToMarkdown(editor.getJSON());

    const result =
      props.mode === "new"
        ? await callWriteApi<{ id: string; sha: string }>("/api/notes", {
            method: "POST",
            body: { title, notebook, tags, content, message: commitMessage },
          })
        : await callWriteApi<{ id: string; sha: string }>(
            `/api/notes/${encodeNoteIdForUrl(props.note.id)}`,
            {
              method: "PUT",
              body: {
                title,
                tags,
                content,
                message: commitMessage,
                sha: props.note.sha,
              },
            },
          );

    if (result.ok) {
      allowLeaveRef.current = true;
      // A full load, so both the note page and the list come from the
      // freshly revalidated cache rather than the client router's copy.
      window.location.assign(noteHref(result.data.id));
      return;
    }

    setSaving(false);
    const { error } = result;
    if (props.mode === "edit" && error.code === "conflict") {
      setCommitOpen(false);
      setConflict("changed");
      return;
    }
    if (props.mode === "edit" && error.code === "not_found") {
      setCommitOpen(false);
      setConflict("deleted");
      return;
    }
    if (error.code === "unauthorized") {
      setSaveError(
        "Your session has expired. Sign in again in a new tab (this draft stays open here), then commit again.",
      );
      return;
    }
    setSaveError(describeWriteFailure(error));
  };

  // --- Conflict recovery ---------------------------------------------------

  const draftFile = () => {
    const body = editor ? docToMarkdown(editor.getJSON()) : "";
    return `---\ntitle: ${JSON.stringify(title)}\ntags: ${JSON.stringify(tags)}\n---\n\n${body}\n`;
  };

  const copyDraft = async () => {
    const text = draftFile();
    let copied = false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // Falls through to the legacy path.
    }
    if (!copied) copied = legacyCopy(text);
    setDraftNotice(
      copied
        ? "Draft copied to the clipboard."
        : "Couldn't copy — use Download instead.",
    );
  };

  const downloadDraft = () => {
    const blob = new Blob([draftFile()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugPreview}-draft.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDraftNotice("Draft downloaded.");
  };

  const cancelHref = props.mode === "edit" ? noteHref(props.note.id) : "/";
  const saveBlocked =
    !editor ||
    saving ||
    (props.mode === "edit" && !isDirty) ||
    (fidelity !== null && !fidelity.faithful && !fidelityAck);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={cancelHref}
          className="text-muted hover:text-foreground hover:bg-surface-hover -ml-2 inline-flex h-11 items-center rounded-lg px-2 text-sm"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          <LogoutButton />
          <button
            ref={saveButtonRef}
            type="button"
            onClick={openCommit}
            disabled={saveBlocked}
            title="Save (Ctrl+S)"
            className="bg-accent text-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save
          </button>
        </div>
      </div>

      {conflict && (
        <section
          role="alert"
          className="border-danger/50 bg-surface rounded-2xl border p-4 sm:p-5"
        >
          <h2 className="text-danger flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            {conflict === "changed"
              ? "This note changed elsewhere since you opened it"
              : "This note was deleted or moved elsewhere"}
          </h2>
          <p className="text-muted mt-2 text-sm">
            {conflict === "changed"
              ? "A newer version was saved — in another tab, on another device, or directly on GitHub. Nothing was overwritten, and your edits are still here. Keep a copy of your draft, then reload the latest version to redo your changes on top of it."
              : "Nothing was saved, and your edits are still here. Keep a copy of your draft before leaving this page."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyDraft}
              className="border-border hover:bg-surface-hover inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy draft
            </button>
            <button
              type="button"
              onClick={downloadDraft}
              className="border-border hover:bg-surface-hover inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download draft
            </button>
            {conflict === "changed" && (
              <button
                type="button"
                onClick={() => setConfirmReload(true)}
                className="bg-accent text-accent-foreground inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reload latest version
              </button>
            )}
          </div>
          {draftNotice && (
            <p className="text-muted mt-3 text-sm" aria-live="polite">
              {draftNotice}
            </p>
          )}
        </section>
      )}

      {fidelity && !fidelity.faithful && (
        <section
          role="alert"
          className="border-border bg-surface rounded-2xl border p-4 text-sm"
        >
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert
              className="text-danger mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              This note contains{" "}
              {fidelity.constructs.length
                ? fidelity.constructs.join(" and ")
                : "formatting"}{" "}
              the editor can&apos;t reproduce exactly. Saving will change how
              those parts look.
            </span>
          </p>
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={fidelityAck}
              onChange={(event) => setFidelityAck(event.target.checked)}
              className="accent-accent h-4 w-4"
            />
            I understand — let me save anyway
          </label>
        </section>
      )}

      <div>
        <label htmlFor={titleId} className="sr-only">
          Title
        </label>
        <input
          id={titleId}
          ref={titleRef}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (titleError) setTitleError(null);
          }}
          placeholder="Untitled note"
          maxLength={200}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${titleId}-error` : undefined}
          className="placeholder:text-muted/70 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
        />
        {titleError && (
          <p
            id={`${titleId}-error`}
            role="alert"
            className="text-danger mt-1 text-sm"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={notebookId}
            className="text-muted mb-1.5 block text-xs font-medium tracking-widest uppercase"
          >
            Notebook
          </label>
          {props.mode === "edit" ? (
            <>
              <div className="border-border bg-background text-muted flex h-11 items-center gap-2 rounded-xl border px-3 text-sm">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <input
                  id={notebookId}
                  value={initial.notebook || "uncategorized"}
                  disabled
                  aria-describedby={`${notebookId}-help`}
                  className="min-w-0 flex-1 bg-transparent"
                />
              </div>
              <p
                id={`${notebookId}-help`}
                className="text-muted mt-1.5 text-xs"
              >
                Moving a note to another notebook isn&apos;t supported yet. To
                move it, create a new note in the other notebook. Changing the
                title keeps the file at{" "}
                <code>{notePathFor(props.note.id)}</code>.
              </p>
            </>
          ) : (
            <>
              <input
                id={notebookId}
                value={notebook}
                onChange={(event) => setNotebook(event.target.value)}
                list={notebookListId}
                placeholder="uncategorized"
                autoComplete="off"
                aria-invalid={notebookResult.ok ? undefined : true}
                aria-describedby={`${notebookId}-help`}
                className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
              />
              <datalist id={notebookListId}>
                {props.notebooks.map((nb) => (
                  <option key={nb.path} value={nb.path} />
                ))}
              </datalist>
              <p
                id={`${notebookId}-help`}
                className={`mt-1.5 text-xs ${notebookResult.ok ? "text-muted" : "text-danger"}`}
                role={notebookResult.ok ? undefined : "alert"}
              >
                {notebookResult.ok ? (
                  <>
                    Saved as{" "}
                    <code>
                      {notePathFor(
                        noteIdFor(notebookResult.value, slugPreview),
                      )}
                    </code>{" "}
                    (a number is added if that name is taken). Type a new path
                    like <code>study/programming</code> to create a notebook.
                  </>
                ) : (
                  notebookResult.error
                )}
              </p>
            </>
          )}
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
            suggestions={props.tagSuggestions}
            onChange={setTags}
          />
        </div>
      </div>

      <NoteEditor editor={editor} />

      <CommitDialog
        open={commitOpen}
        message={commitMessage}
        onMessageChange={setCommitMessage}
        pending={saving}
        error={saveError}
        onConfirm={commit}
        onCancel={() => setCommitOpen(false)}
        returnFocus={() => saveButtonRef.current}
      />

      <ConfirmDialog
        open={pendingNav !== null}
        tone="danger"
        title={saving ? "A save is in progress" : "Discard unsaved changes?"}
        description={
          saving
            ? "Leaving now won't cancel the save, but you won't see whether it worked."
            : "Your edits to this note haven't been saved to GitHub and will be lost."
        }
        confirmLabel="Leave page"
        cancelLabel="Stay"
        onConfirm={() => pendingNav && leaveTo(pendingNav)}
        onCancel={() => setPendingNav(null)}
      />

      <ConfirmDialog
        open={confirmReload}
        tone="danger"
        title="Discard your edits and reload?"
        description="The latest version from GitHub will replace everything in the editor. Copy or download your draft first if you want to keep it."
        confirmLabel="Discard and reload"
        cancelLabel="Keep my draft"
        onConfirm={() => {
          allowLeaveRef.current = true;
          window.location.reload();
        }}
        onCancel={() => setConfirmReload(false)}
      />
    </div>
  );
}
