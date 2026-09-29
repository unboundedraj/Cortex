"use client";

import { Ellipsis, Folder, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, memo, useId, useRef, useState } from "react";
import { useDismiss } from "@/lib/hooks";
import { rememberListNavigation } from "@/lib/list-navigation";
import { formatNoteDate } from "@/lib/note-filter";
import { notebookDisplayPath } from "@/lib/notebook-tree";
import { noteEditHref, noteHref } from "@/lib/routes";
import type { SnippetPart } from "@/lib/search-snippet";
import type { NoteMeta } from "@/types/note";

const MAX_VISIBLE_TAGS = 3;

export interface NoteBarActions {
  onToggleTag: (tag: string) => void;
  onTogglePin: (note: NoteMeta) => void;
  onRequestDelete: (note: NoteMeta, returnFocusTo: HTMLElement | null) => void;
}

const iconButton =
  "text-muted hover:text-foreground hover:bg-background grid h-9 w-9 place-items-center rounded-lg transition-colors";

function MobileActionsMenu({
  note,
  onTogglePin,
  onRequestDelete,
}: { note: NoteMeta } & Omit<NoteBarActions, "onToggleTag">) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useDismiss(wrapperRef, open, (reason) => {
    setOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  });

  const item =
    "hover:bg-surface-hover flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm";

  return (
    <div
      ref={wrapperRef}
      className={`relative sm:hidden ${open ? "z-20" : "z-10"}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${note.title}`}
        className="text-muted hover:text-foreground -my-2 -mr-2 grid h-11 w-11 place-items-center rounded-lg"
      >
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          className="animate-fade-in bg-surface border-border absolute top-full right-0 mt-1 w-44 rounded-xl border p-1 shadow-xl"
        >
          <Link
            href={noteEditHref(note.id)}
            prefetch={false}
            onClick={() => rememberListNavigation(noteEditHref(note.id))}
            className={item}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onTogglePin(note);
            }}
          >
            {note.pinned ? (
              <PinOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pin className="h-4 w-4" aria-hidden="true" />
            )}
            {note.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className={`${item} text-danger`}
            onClick={() => {
              setOpen(false);
              onRequestDelete(note, triggerRef.current);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NoteBarImpl({
  note,
  activeTags,
  snippet,
  onToggleTag,
  onTogglePin,
  onRequestDelete,
}: {
  note: NoteMeta;
  activeTags: ReadonlySet<string>;
  /** Present only when the search matched text in the body. */
  snippet: SnippetPart[] | null;
} & NoteBarActions) {
  const visibleTags = note.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTags = note.tags.slice(MAX_VISIBLE_TAGS);

  return (
    <li className="group border-border bg-surface hover:bg-surface-hover relative rounded-xl border transition-colors">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {note.pinned && (
              <Pin
                className="text-accent h-3.5 w-3.5 shrink-0 fill-current"
                aria-hidden="true"
              />
            )}
            <Link
              href={noteHref(note.id)}
              onClick={() => rememberListNavigation(noteHref(note.id))}
              className="stretched-link truncate font-medium"
            >
              {note.title}
              {note.pinned && <span className="sr-only"> (pinned)</span>}
            </Link>
          </div>

          {snippet ? (
            // Where in the body the search matched — shown on every width,
            // unlike the plain excerpt.
            <p className="text-muted mt-0.5 line-clamp-2 text-sm">
              {snippet.map((part, index) =>
                part.hit ? (
                  <mark key={index} className="search-hit">
                    {part.text}
                  </mark>
                ) : (
                  <Fragment key={index}>{part.text}</Fragment>
                ),
              )}
            </p>
          ) : (
            note.excerpt && (
              <p className="text-muted mt-0.5 hidden truncate text-sm md:block">
                {note.excerpt}
              </p>
            )
          )}

          <div className="text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <time dateTime={note.date}>{formatNoteDate(note.date)}</time>
            <span className="inline-flex max-w-full min-w-0 items-center gap-1">
              <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {notebookDisplayPath(note.notebook)}
              </span>
            </span>
            {note.tags.length > 0 && (
              <span className="relative z-10 flex flex-wrap items-center gap-1.5">
                {visibleTags.map((tag) => {
                  const active = activeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      aria-pressed={active}
                      title={
                        active ? `Remove #${tag} filter` : `Filter by #${tag}`
                      }
                      className={`rounded-full border px-2 py-0.5 transition-colors ${
                        active
                          ? "bg-accent text-accent-foreground border-transparent"
                          : "border-border hover:bg-background hover:text-foreground"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
                {hiddenTags.length > 0 && (
                  <span
                    className="px-1"
                    title={hiddenTags.map((t) => `#${t}`).join(", ")}
                  >
                    +{hiddenTags.length}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="reveal-on-hover relative z-10 hidden items-center gap-0.5 sm:flex">
          <Link
            href={noteEditHref(note.id)}
            prefetch={false}
            onClick={() => rememberListNavigation(noteEditHref(note.id))}
            aria-label={`Edit ${note.title}`}
            title="Edit"
            className={iconButton}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            aria-label={`${note.pinned ? "Unpin" : "Pin"} ${note.title}`}
            title={note.pinned ? "Unpin" : "Pin"}
            className={iconButton}
          >
            {note.pinned ? (
              <PinOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pin className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => onRequestDelete(note, e.currentTarget)}
            aria-label={`Delete ${note.title}`}
            title="Delete"
            className={`${iconButton} hover:text-danger`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <MobileActionsMenu
          note={note}
          onTogglePin={onTogglePin}
          onRequestDelete={onRequestDelete}
        />
      </div>
    </li>
  );
}

export const NoteBar = memo(NoteBarImpl);
