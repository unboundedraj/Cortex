"use client";

import {
  ChevronRight,
  Folder,
  FolderOpen,
  Inbox,
  Library,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useBodyScrollLock, useFocusTrap } from "@/lib/hooks";
import {
  ancestorPaths,
  UNCATEGORIZED_PATH,
  type NotebookNode,
} from "@/lib/notebook-tree";

interface NavProps {
  tree: NotebookNode[];
  total: number;
  selected: string | null;
  onSelect: (path: string | null) => void;
}

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 250;

function rowClass(active: boolean, compact: boolean) {
  return [
    "flex min-w-0 items-center gap-2.5 rounded-lg text-sm transition-colors",
    // Drawer rows (below md) get 44px touch targets; desktop rows stay dense.
    compact ? "h-10 w-10 shrink-0 justify-center" : "h-11 flex-1 px-2 md:h-9",
    active
      ? "bg-accent/15 text-foreground font-medium"
      : "text-foreground/80 hover:bg-surface-hover hover:text-foreground",
  ].join(" ");
}

function NotebookRow({
  node,
  depth,
  compact,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  node: NotebookNode;
  depth: number;
  compact: boolean;
  selected: string | null;
  expanded: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const isActive = selected === node.path;
  const Icon =
    node.path === UNCATEGORIZED_PATH
      ? Inbox
      : hasChildren && isOpen
        ? FolderOpen
        : Folder;

  // The rail only shows top-level notebooks; nested rows appear once the
  // sidebar expands (hover, keyboard focus, or pinned).
  if (compact && depth > 0) return null;

  return (
    <li>
      <div
        className="flex items-center"
        style={compact ? undefined : { paddingLeft: depth * 14 }}
      >
        {!compact &&
          (hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.path)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.label}`}
              className="text-muted hover:text-foreground grid h-11 w-6 shrink-0 place-items-center rounded md:h-9"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          ))}
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          aria-current={isActive ? "true" : undefined}
          title={compact ? `${node.label} (${node.count})` : undefined}
          className={rowClass(isActive, compact)}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span
            className={
              compact ? "sr-only" : "min-w-0 flex-1 truncate text-left"
            }
          >
            {node.label}
          </span>
          <span
            className={compact ? "sr-only" : "text-muted text-xs tabular-nums"}
          >
            {compact ? `, ${node.count} notes` : node.count}
          </span>
        </button>
      </div>
      {hasChildren && isOpen && !compact && (
        <ul>
          {node.children.map((child) => (
            <NotebookRow
              key={child.path}
              node={child}
              depth={depth + 1}
              compact={compact}
              selected={selected}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NotebookNav({
  tree,
  total,
  selected,
  onSelect,
  compact = false,
}: NavProps & { compact?: boolean }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(selected ? ancestorPaths(selected) : []),
  );

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className={compact ? "flex flex-col items-center" : ""}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={selected === null ? "true" : undefined}
        title={compact ? `All notes (${total})` : undefined}
        className={`${rowClass(selected === null, compact)} ${compact ? "" : "w-full pl-8"}`}
      >
        <Library className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={compact ? "sr-only" : "flex-1 text-left"}>
          All notes
        </span>
        <span
          className={compact ? "sr-only" : "text-muted text-xs tabular-nums"}
        >
          {compact ? `, ${total} notes` : total}
        </span>
      </button>

      <p
        className={
          compact
            ? "sr-only"
            : "text-muted mt-4 mb-1 px-2 text-xs font-medium tracking-widest uppercase"
        }
      >
        Notebooks
      </p>
      {tree.length === 0 ? (
        !compact && (
          <p className="text-muted px-2 py-1 text-sm">No notebooks yet</p>
        )
      ) : (
        <ul className={compact ? "mt-1 flex flex-col items-center gap-1" : ""}>
          {tree.map((node) => (
            <NotebookRow
              key={node.path}
              node={node}
              depth={0}
              compact={compact}
              selected={selected}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Desktop (md+): a slim icon rail that expands as an overlay on hover (with
 * a short intent delay) or on keyboard focus, without shifting the layout.
 * Pinning keeps it open and makes it take up space (pushes content). Pin
 * state is deliberately not persisted.
 */
export function DesktopSidebar(props: NavProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const expanded = pinned || hovered || keyboardFocus;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const scheduleHover = (value: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(value), delay);
  };

  // Only keyboard focus expands the rail — a mouse click on a rail icon
  // shouldn't leave it stuck open after the pointer leaves.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target.matches(":focus-visible")) setKeyboardFocus(true);
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setKeyboardFocus(false);
    }
  };

  return (
    <aside
      aria-label="Notebooks"
      className={`sidebar-width relative hidden shrink-0 md:block ${pinned ? "w-64" : "w-14"}`}
    >
      {/* z-30 lives here, not just on the panel: `position: sticky` creates
          its own stacking context, so without it the expanded overlay would
          paint underneath positioned content in <main>. */}
      <div className="sticky top-16 z-30 h-[calc(100dvh-4rem)]">
        <div
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse")
              scheduleHover(true, HOVER_OPEN_DELAY);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") {
              scheduleHover(false, HOVER_CLOSE_DELAY);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`sidebar-width border-border bg-surface absolute inset-y-0 left-0 z-30 flex flex-col overflow-hidden border-r ${
            expanded ? "w-64" : "w-14"
          } ${expanded && !pinned ? "shadow-xl" : ""}`}
        >
          <div
            className={`flex h-14 shrink-0 items-center ${expanded ? "justify-between pr-2 pl-4" : "justify-center"}`}
          >
            <span
              className={
                expanded
                  ? "text-muted text-xs font-medium tracking-widest uppercase"
                  : "sr-only"
              }
            >
              Library
            </span>
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              className="text-muted hover:text-foreground hover:bg-surface-hover grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            >
              {pinned ? (
                <PinOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pin className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <nav
            aria-label="Notebooks"
            className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-4"
          >
            <NotebookNav {...props} compact={!expanded} />
          </nav>
        </div>
      </div>
    </aside>
  );
}

/** Mobile (<md): an overlay drawer from the left with a backdrop. */
export function MobileNotebookDrawer({
  open,
  onClose,
  returnFocus,
  ...navProps
}: NavProps & {
  open: boolean;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, { onEscape: onClose, returnFocus });
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="animate-fade-in bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notebooks"
        tabIndex={-1}
        className="animate-drawer-in bg-surface border-border absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r shadow-2xl outline-none"
      >
        <div className="border-border flex h-16 shrink-0 items-center justify-between border-b pr-2 pl-4">
          <span className="text-muted text-xs font-medium tracking-widest uppercase">
            Library
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notebooks"
            className="hover:bg-surface-hover grid h-11 w-11 place-items-center rounded-lg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Notebooks" className="flex-1 overflow-y-auto p-2">
          <NotebookNav {...navProps} />
        </nav>
      </div>
    </div>
  );
}
