"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import type { RefObject } from "react";
import type { SearchIndexStatus } from "@/lib/use-search-index";

export function SearchBox({
  value,
  onChange,
  onActivate,
  status,
  slow,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Starts loading the full-text index; safe to call repeatedly. */
  onActivate: () => void;
  status: SearchIndexStatus;
  /** True only once loading has taken > 300 ms. */
  slow: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const preparing = status === "loading" && slow;

  return (
    <div className="relative sm:flex-1">
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onFocus={onActivate}
        onChange={(event) => {
          onActivate();
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) onChange("");
          else event.currentTarget.blur();
        }}
        placeholder="Search notes"
        aria-label="Search notes"
        aria-keyshortcuts="/"
        aria-busy={preparing}
        autoComplete="off"
        spellCheck={false}
        className="border-border bg-surface placeholder:text-muted h-11 w-full rounded-xl border pr-20 pl-10 text-sm"
      />
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        {preparing && (
          <span
            className="text-muted mr-1 inline-flex items-center"
            title="Preparing full-text search…"
          >
            <LoaderCircle
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="sr-only">Preparing full-text search…</span>
          </span>
        )}
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="text-muted hover:text-foreground grid h-9 w-9 place-items-center rounded-lg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          !preparing && (
            <kbd
              aria-hidden="true"
              className="border-border text-muted pointer-events-none mr-2 hidden rounded border px-1.5 font-sans text-xs sm:block"
            >
              /
            </kbd>
          )
        )}
      </div>
    </div>
  );
}
