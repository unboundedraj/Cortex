"use client";

import { FileText, Folder, Menu, Plus, SearchX, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { SearchBox } from "@/components/search-box";
import {
  bodyOnlyTerms,
  createIndexSearch,
  dateFilterLabel,
  DEFAULT_FILTER_STATE,
  filterAndSortNotes,
  hasActiveFilters,
  isDateActive,
  localDay,
  searchNotes,
  serializeFilterState,
  SORT_OPTIONS,
  substringSearch,
  usesRelevanceOrder,
  type NoteFilterState,
} from "@/lib/note-filter";
import { SEARCH_OPTIONS } from "@/lib/search-config";
import { buildSnippet, type SnippetPart } from "@/lib/search-snippet";
import { useSearchIndex } from "@/lib/use-search-index";
import { useSnippetTexts } from "@/lib/use-snippet-texts";
import { buildNotebookTree, notebookDisplayPath } from "@/lib/notebook-tree";
import { rememberListNavigation } from "@/lib/list-navigation";
import {
  describeDeleteFailure,
  requestDelete,
  type WriteFailure,
} from "@/lib/notes-client";
import type { NoteMeta, NotebookSummary, TagSummary } from "@/types/note";

export interface NotesWorkspaceProps {
  notes: NoteMeta[];
  notebooks: NotebookSummary[];
  tags: TagSummary[];
  inert: boolean;
  initialState: NoteFilterState;
  /** Content hash of the search index the page was rendered with. */
  searchIndexVersion: string;
}

const MAX_SNIPPETS = 20;

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
  notes: loadedNotes,
  notebooks,
  tags,
  inert,
  initialState,
  searchIndexVersion,
}: NotesWorkspaceProps) {
  const [state, setState] = useState(initialState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    note: NoteMeta;
    returnFocusTo: HTMLElement | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<WriteFailure | null>(null);
  // Hidden right away on a successful delete; router.refresh() then brings
  // the revalidated list from the server.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const notes = useMemo(
    () => loadedNotes.filter((note) => !removedIds.has(note.id)),
    [loadedNotes, removedIds],
  );
  const router = useRouter();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // "Today" for date presets. Fixed for the life of the page; only affects
  // results when a relative date preset is active.
  const [today] = useState(() => localDay(new Date()));

  const tree = useMemo(() => buildNotebookTree(notebooks), [notebooks]);

  // Full-text search: the index loads on first interaction with the search
  // box. Until it's ready (or if it fails), the substring fallback keeps
  // results coming, and they refine automatically once it arrives.
  const searchIndex = useSearchIndex(searchIndexVersion);
  const search = useMemo(
    () =>
      searchIndex.index
        ? createIndexSearch(searchIndex.index, SEARCH_OPTIONS)
        : substringSearch,
    [searchIndex.index],
  );
  const hits = useMemo(
    () => searchNotes(notes, state.query, search),
    [notes, state.query, search],
  );
  const visibleNotes = useMemo(
    () => filterAndSortNotes(notes, state, { today, hits }),
    [notes, state, today, hits],
  );
  const byRelevance = usesRelevanceOrder(state, hits);

  // A query restored from the URL (e.g. coming back from a note) counts as
  // search interaction, so load the index without waiting for a focus.
  const [hadInitialQuery] = useState(() => initialState.query.trim() !== "");
  const loadIndex = searchIndex.load;
  useEffect(() => {
    if (!hadInitialQuery) return;
    const timer = window.setTimeout(loadIndex, 0);
    return () => window.clearTimeout(timer);
  }, [hadInitialQuery, loadIndex]);

  // Snippets only for visible results whose match came from the body.
  const snippetIds = useMemo(
    () =>
      hits
        ? visibleNotes
            .slice(0, MAX_SNIPPETS)
            .filter((note) => bodyOnlyTerms(hits.get(note.id)).length > 0)
            .map((note) => note.id)
        : [],
    [hits, visibleNotes],
  );
  const snippetTexts = useSnippetTexts(
    searchIndexVersion,
    snippetIds,
    state.query,
  );
  const snippets = useMemo(() => {
    const result = new Map<string, SnippetPart[]>();
    if (!hits) return result;
    for (const id of snippetIds) {
      const hit = hits.get(id);
      const text = snippetTexts.get(id);
      if (!hit || !text) continue;
      const snippet = buildSnippet(
        text,
        bodyOnlyTerms(hit),
        Object.keys(hit.match),
      );
      if (snippet) result.set(id, snippet);
    }
    return result;
  }, [hits, snippetIds, snippetTexts]);

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

  // TODO(writes): pin/unpin is still a stub.
  const handleTogglePin = useCallback(
    (note: NoteMeta) =>
      showToast(
        note.pinned ? "Unpinning is coming soon" : "Pinning is coming soon",
      ),
    [showToast],
  );

  const handleRequestDelete = useCallback(
    (note: NoteMeta, returnFocusTo: HTMLElement | null) => {
      setDeleteError(null);
      setPendingDelete({ note, returnFocusTo });
    },
    [],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { note } = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    const result = await requestDelete(note);
    setDeleting(false);

    // Already gone elsewhere is still the outcome the user asked for.
    if (result.ok || result.error.code === "not_found") {
      setRemovedIds((prev) => new Set(prev).add(note.id));
      setPendingDelete(null);
      showToast(
        result.ok
          ? `Deleted “${note.title}”`
          : `“${note.title}” was already deleted elsewhere`,
      );
      router.refresh();
      return;
    }

    setDeleteError(result.error);
    // The server revalidated on conflict — pull the fresh sha so a retry
    // after reviewing the change can succeed.
    if (result.error.code === "conflict") router.refresh();
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
            <SearchBox
              value={state.query}
              onChange={(query) => update({ query })}
              onActivate={searchIndex.load}
              status={searchIndex.status}
              slow={searchIndex.slow}
              inputRef={searchRef}
            />

            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <FilterPopover
                tags={tags}
                state={state}
                onChange={update}
                onReset={resetPopoverFilters}
              />
              <Link
                href="/new"
                onClick={() => rememberListNavigation("/new")}
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
              {byRelevance && " · best match first"}
              {state.query.trim() &&
                searchIndex.status === "error" &&
                " · full-text search unavailable, matching titles, tags and excerpts"}
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
                  onClick={() => rememberListNavigation("/new")}
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
                  snippet={snippets.get(note.id) ?? null}
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
        description="This permanently removes the note from your notes repo (it stays recoverable from the repo's git history)."
        confirmLabel={deleting ? "Deleting…" : "Delete note"}
        pending={deleting}
        error={
          deleteError && (
            <>
              {describeDeleteFailure(deleteError)}{" "}
              {deleteError.code === "unauthorized" && (
                <Link href="/login?from=%2F" className="underline">
                  Sign in
                </Link>
              )}
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        returnFocus={() => pendingDelete?.returnFocusTo ?? null}
      />

      <Toast message={toast.message} />
    </>
  );
}
