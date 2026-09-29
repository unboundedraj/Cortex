"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Landing } from "@/components/landing";
import {
  NotesWorkspace,
  type NotesWorkspaceProps,
} from "@/components/notes-workspace";
import { DEFAULT_FILTER_STATE, parseFilterState } from "@/lib/note-filter";
import type { NoteMeta, NotebookSummary, TagSummary } from "@/types/note";

const ENTERED_KEY = "cortex-entered";
const ENTERED_ATTR = "data-entered";

type WorkspaceDataProps = Omit<NotesWorkspaceProps, "initialState">;

function WorkspaceFromUrl(props: WorkspaceDataProps) {
  const searchParams = useSearchParams();
  // Read once: afterwards local state is the source of truth and only
  // writes back to the URL.
  const [initialState] = useState(() => parseFilterState(searchParams));
  return <NotesWorkspace {...props} initialState={initialState} />;
}

export function HomeClient({
  notes,
  notebooks,
  tags,
  searchIndexVersion,
}: {
  notes: NoteMeta[];
  notebooks: NotebookSummary[];
  tags: TagSummary[];
  searchIndexVersion: string;
}) {
  // Both the server render and the first client render start from `false`
  // so hydration never mismatches structurally. The inline script in
  // app/layout.tsx already set data-entered + hid .landing-overlay via CSS
  // for returning visitors before this ever painted, so the effect below
  // just finishes the unmount a beat later — invisibly.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (document.documentElement.getAttribute(ENTERED_ATTR) === "true") {
      // Deliberate: this corrects render state from a client-only source
      // (the attribute the anti-flash script set) rather than delaying a
      // prop/state change, which is exactly what a lazy useState
      // initializer can't safely do here without mismatching the server
      // render structurally (Landing present vs. absent).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntered(true);
    }
  }, []);

  const handleEnter = useCallback(() => {
    setEntered(true);
    document.documentElement.setAttribute(ENTERED_ATTR, "true");
    try {
      window.localStorage.setItem(ENTERED_KEY, "true");
    } catch {
      // Storage unavailable (private browsing, disabled, etc.) — the
      // landing will just show again next visit, which is fine.
    }
  }, []);

  const data: WorkspaceDataProps = {
    notes,
    notebooks,
    tags,
    inert: !entered,
    searchIndexVersion,
  };

  return (
    <>
      {/*
        useSearchParams makes everything up to the nearest Suspense boundary
        client-rendered in a prerendered route. The boundary wraps only the
        workspace so the landing overlay stays in the static HTML (the
        anti-flash behavior depends on that), and the fallback is the same
        workspace in its default state so the prerendered page is complete
        rather than a skeleton.
      */}
      <Suspense
        fallback={
          <NotesWorkspace {...data} initialState={DEFAULT_FILTER_STATE} />
        }
      >
        <WorkspaceFromUrl {...data} />
      </Suspense>
      {!entered && <Landing onEnter={handleEnter} />}
    </>
  );
}
