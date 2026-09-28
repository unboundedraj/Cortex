"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { useDismiss } from "@/lib/hooks";
import {
  countPopoverFilters,
  DATE_PRESETS,
  SORT_OPTIONS,
  type NoteFilterState,
} from "@/lib/note-filter";
import type { TagSummary } from "@/types/note";

const optionRow =
  "hover:bg-surface-hover flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm sm:h-9";
const legend =
  "text-muted mb-1.5 px-2 text-xs font-medium tracking-widest uppercase";

export function FilterPopover({
  tags,
  state,
  onChange,
  onReset,
}: {
  tags: TagSummary[];
  state: NoteFilterState;
  onChange: (patch: Partial<NoteFilterState>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const activeCount = countPopoverFilters(state);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useDismiss(wrapperRef, open, (reason) => close(reason === "escape"));

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Tabbing past the last control closes it (non-modal popover behavior).
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && !event.currentTarget.contains(next)) setOpen(false);
  };

  const toggleTag = (tag: string) =>
    onChange({
      tags: state.tags.includes(tag)
        ? state.tags.filter((t) => t !== tag)
        : [...state.tags, tag],
    });

  return (
    <div ref={wrapperRef} className="relative" onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label={
          activeCount
            ? `Filters and sort, ${activeCount} active`
            : "Filters and sort"
        }
        className={`border-border relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
          open || activeCount
            ? "bg-surface-hover text-foreground"
            : "bg-surface hover:bg-surface-hover"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <span className="sm:hidden" aria-hidden="true">
          Filters
        </span>
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums"
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="animate-fade-in bg-background/70 fixed inset-0 z-40 backdrop-blur-sm sm:hidden"
            onClick={() => close(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Filter and sort notes"
            tabIndex={-1}
            className="animate-sheet-in-mobile animate-fade-in bg-surface border-border fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border shadow-2xl outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:z-30 sm:mt-2 sm:max-h-[70dvh] sm:w-80 sm:rounded-xl"
          >
            <div className="flex-1 space-y-5 overflow-y-auto p-3">
              <fieldset>
                <legend className={legend}>Tags</legend>
                {tags.length === 0 ? (
                  <p className="text-muted px-2 text-sm">No tags yet</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {tags.map(({ tag, count }) => (
                      <label key={tag} className={optionRow}>
                        <input
                          type="checkbox"
                          checked={state.tags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                          className="accent-accent h-4 w-4"
                        />
                        <span className="min-w-0 flex-1 truncate">#{tag}</span>
                        <span className="text-muted text-xs tabular-nums">
                          {count}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <fieldset>
                <legend className={legend}>Date</legend>
                <div className="grid grid-cols-2 gap-x-1">
                  {DATE_PRESETS.map((preset) => (
                    <label key={preset.value} className={optionRow}>
                      <input
                        type="radio"
                        name={`${panelId}-date`}
                        checked={state.date === preset.value}
                        onChange={() => onChange({ date: preset.value })}
                        className="accent-accent h-4 w-4"
                      />
                      {preset.label}
                    </label>
                  ))}
                </div>
                {state.date === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2 px-2">
                    <label className="text-muted flex flex-col gap-1 text-xs">
                      From
                      <input
                        type="date"
                        value={state.from}
                        onChange={(e) => onChange({ from: e.target.value })}
                        className="border-border bg-background text-foreground h-10 rounded-lg border px-2 text-sm"
                      />
                    </label>
                    <label className="text-muted flex flex-col gap-1 text-xs">
                      To
                      <input
                        type="date"
                        value={state.to}
                        onChange={(e) => onChange({ to: e.target.value })}
                        className="border-border bg-background text-foreground h-10 rounded-lg border px-2 text-sm"
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              <fieldset>
                <legend className={legend}>Sort</legend>
                {SORT_OPTIONS.map((option) => (
                  <label key={option.value} className={optionRow}>
                    <input
                      type="radio"
                      name={`${panelId}-sort`}
                      checked={state.sort === option.value}
                      onChange={() => onChange({ sort: option.value })}
                      className="accent-accent h-4 w-4"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="border-border flex items-center justify-between gap-2 border-t p-3">
              <button
                type="button"
                onClick={onReset}
                disabled={activeCount === 0}
                className="text-muted hover:text-foreground h-11 rounded-lg px-3 text-sm disabled:opacity-40 sm:h-9"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className="bg-accent text-accent-foreground h-11 rounded-lg px-4 text-sm font-medium hover:opacity-90 sm:h-9"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
