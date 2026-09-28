"use client";

import { FileText, Folder, Menu, Plus, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FilterPopover } from "@/components/filter-popover";
import { NoteBar } from "@/components/note-bar";
import {
  DesktopSidebar,
  MobileNotebookDrawer,
} from "@/components/notebook-sidebar";
import { Toast, useToast } from "@/components/toast";
import {
  dateFilterLabel,
  DEFAULT_FILTER_STATE,
  filterAndSortNotes,
  hasActiveFilters,
  isDateActive,
  localDay,
  serializeFilterState,
  SORT_OPTIONS,
  type NoteFilterState,
} from "@/lib/note-filter";
import { buildNotebookTree, notebookDisplayPath } from "@/lib/notebook-tree";
import { LAST_LIST_URL_KEY } from "@/lib/routes";
import type { NoteMeta, NotebookSummary, TagSummary } from "@/types/note";

export interface NotesWorkspaceProps {
  notes: NoteMeta[];
  notebooks: NotebookSummary[];
  tags: TagSummary[];
  inert: boolean;
  initialState: NoteFilterState;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="bg-surface text-muted mb-4 grid h-12 w-12 place-items-center rounded-full">
        {icon}
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-muted mt-1 max-w-sm text-sm">{body}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

export function NotesWorkspace({
  notes,
  notebooks,
  tags,
  inert,
  initialState,
}: NotesWorkspaceProps) {
  const [state, setState] = useState(initialState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    note: NoteMeta;
    returnFocusTo: HTMLElement | null;
  } | null>(null);
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // "Today" for date presets. Fixed for the life of the page; only affects
  // results when a relative date preset is active.
  const [today] = useState(() => localDay(new Date()));

  const tree = useMemo(() => buildNotebookTree(notebooks), [notebooks]);
  const visibleNotes = useMemo(
    () => filterAndSortNotes(notes, state, { today }),
    [notes, state, today],
  );
  const activeTags = useMemo(() => new Set(state.tags), [state.tags]);

  // One-way sync: local state is the source of truth; the URL mirrors it.
  // Native replaceState (which Next integrates with useSearchParams) instead
  // of router.replace: same no-history-entry semantics, but no RSC request
  // per keystroke.
  useEffect(() => {
    const query = serializeFilterState(state).toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", url);
    }
    try {
      window.sessionStorage.setItem(LAST_LIST_URL_KEY, url);
    } catch {
      // Storage unavailable — "back to notes" links just go to "/".
    }
  }, [state, pathname]);

  // "/" focuses search, unless typing somewhere, a modal is open, or the
  // landing overlay still covers the app.
  useEffect(() => {
    if (inert) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [inert]);

  const update = useCallback(
    (patch: Partial<NoteFilterState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  const toggleTag = useCallback(
    (tag: string) =>
      setState((s) => ({
        ...s,
        tags: s.tags.includes(tag)
          ? s.tags.filter((t) => t !== tag)
          : [...s.tags, tag],
      })),
    [],
  );

  const selectNotebook = useCallback(
    (path: string | null) =>
      setState((s) => ({ ...s, notebook: path === s.notebook ? null : path })),
    [],
  );

  const clearAll = useCallback(() => setState(DEFAULT_FILTER_STATE), []);

  const resetPopoverFilters = useCallback(
    () =>
      update({
        tags: [],
        date: "any",
        from: "",
        to: "",
        sort: DEFAULT_FILTER_STATE.sort,
      }),
    [update],
  );

  const { show: showToast } = toast;

  // TODO(writes): pin/unpin and delete are stubs until the write pipeline
  // (commit to the notes repo + revalidate "notes") exists.
  const handleTogglePin = useCallback(
    (note: NoteMeta) =>
      showToast(
        note.pinned ? "Unpinning is coming soon" : "Pinning is coming soon",
      ),
    [showToast],
  );

  const handleRequestDelete = useCallback(
    (note: NoteMeta, returnFocusTo: HTMLElement | null) =>
      setPendingDelete({ note, returnFocusTo }),
    [],
  );

  const confirmDelete = () => {
    // TODO(writes): delete pendingDelete.note from the notes repo.
    setPendingDelete(null);
    showToast("Deleting notes is coming soon");
  };

  const chips: { key: string; label: ReactNode; onRemove: () => void }[] = [];
  if (state.notebook) {
    chips.push({
      key: "notebook",
      label: (
        <>
          <Folder className="h-3 w-3" aria-hidden="true" />
          {notebookDisplayPath(state.notebook)}
        </>
      ),
      onRemove: () => update({ notebook: null }),
    });
  }
  for (const tag of state.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: `#${tag}`,
      onRemove: () => toggleTag(tag),
    });
  }
  if (isDateActive(state)) {
    chips.push({
      key: "date",
      label: dateFilterLabel(state),
      onRemove: () => update({ date: "any", from: "", to: "" }),
    });
  }
  if (state.sort !== DEFAULT_FILTER_STATE.sort) {
    chips.push({
      key: "sort",
      label: `Sort: ${SORT_OPTIONS.find((o) => o.value === state.sort)?.label}`,
      onRemove: () => update({ sort: DEFAULT_FILTER_STATE.sort }),
    });
  }

  const narrowed = Boolean(state.query.trim()) || hasActiveFilters(state);
  const noun = (n: number) => (n === 1 ? "note" : "notes");
  const countText = narrowed
    ? `${visibleNotes.length} of ${notes.length} ${noun(notes.length)}`
    : `${notes.length} ${noun(notes.length)}`;

  return (
    <>
      <AppShell
        inert={inert}
        headerStart={
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open notebooks"
            aria-expanded={drawerOpen}
            className="hover:bg-surface-hover -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        }
        sidebar={
          <DesktopSidebar
            tree={tree}
            total={notes.length}
            selected={state.notebook}
            onSelect={selectNotebook}
          />
        }
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:flex-1">
              <Search
                className="text-muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={state.query}
                onChange={(e) => update({ query: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  if (state.query) update({ query: "" });
                  else e.currentTarget.blur();
                }}
                placeholder="Search notes"
                aria-label="Search notes"
                aria-keyshortcuts="/"
                autoComplete="off"
                spellCheck={false}
                className="border-border bg-surface placeholder:text-muted h-11 w-full rounded-xl border pr-11 pl-10 text-sm"
              />
              {state.query ? (
                <button
                  type="button"
                  onClick={() => {
                    update({ query: "" });
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="text-muted hover:text-foreground absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="border-border text-muted pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 font-sans text-xs sm:block"
                >
                  /
                </kbd>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <FilterPopover
                tags={tags}
                state={state}
                onChange={update}
                onReset={resetPopoverFilters}
              />
              <Link
                href="/new"
                className="bg-accent text-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">Create note</span>
              </Link>
            </div>
          </div>

          <div className="flex min-h-8 flex-wrap items-center gap-2 text-sm">
            <p className="text-muted mr-1" aria-live="polite">
              {countText}
            </p>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="border-border bg-surface hover:bg-surface-hover inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border pr-2 pl-3 text-xs transition-colors"
              >
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  {chip.label}
                </span>
                <X
                  className="text-muted h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">(remove filter)</span>
              </button>
            ))}
            {(chips.length > 0 || state.query) && (
              <button
                type="button"
                onClick={clearAll}
                className="text-muted hover:text-foreground h-8 px-1 text-xs underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {notes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title="No notes yet"
              body="Notes you write will show up here, organized by notebook."
              action={
                <Link
                  href="/new"
                  className="bg-accent text-accent-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium hover:opacity-90"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create your first note
                </Link>
              }
            />
          ) : visibleNotes.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
              title="No notes match"
              body="Try a different search, or clear your filters to see everything."
              action={
                <button
                  type="button"
                  onClick={clearAll}
                  className="border-border bg-surface hover:bg-surface-hover h-11 rounded-xl border px-4 text-sm font-medium"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleNotes.map((note) => (
                <NoteBar
                  key={note.id}
                  note={note}
                  activeTags={activeTags}
                  onToggleTag={toggleTag}
                  onTogglePin={handleTogglePin}
                  onRequestDelete={handleRequestDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </AppShell>

      <MobileNotebookDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnFocus={() => menuButtonRef.current}
        tree={tree}
        total={notes.length}
        selected={state.notebook}
        onSelect={(path) => {
          selectNotebook(path);
          setDrawerOpen(false);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.note.title ?? ""}”?`}
        description="This will permanently remove the note from your notes repo. (Deleting isn't wired up yet — nothing will actually be deleted.)"
        confirmLabel="Delete note"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        returnFocus={() => pendingDelete?.returnFocusTo ?? null}
      />

      <Toast message={toast.message} />
    </>
  );
}
