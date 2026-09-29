import MiniSearch from "minisearch";
import { useCallback, useRef, useState } from "react";
import { MINISEARCH_OPTIONS } from "@/lib/search-config";

export type SearchIndexStatus = "idle" | "loading" | "ready" | "error";

const SLOW_AFTER_MS = 300;

/**
 * Lazily loads the full-text index: nothing is fetched until `load()` is
 * called (first focus of the search box, or a query restored from the URL).
 * One request per page lifetime; every keystroke afterwards searches the
 * in-memory index. `slow` only turns on if loading passes 300 ms, so a fast
 * fetch never flashes a spinner.
 */
export function useSearchIndex(version: string) {
  const [status, setStatus] = useState<SearchIndexStatus>("idle");
  const [index, setIndex] = useState<MiniSearch | null>(null);
  const [slow, setSlow] = useState(false);
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setStatus("loading");
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    (async () => {
      try {
        const response = await fetch(
          `/api/search-index?v=${encodeURIComponent(version)}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loaded = await MiniSearch.loadJSONAsync(
          await response.text(),
          MINISEARCH_OPTIONS,
        );
        setIndex(loaded);
        setStatus("ready");
      } catch (error) {
        // Search keeps working via the substring fallback in note-filter.ts.
        console.warn("[search] Full-text index unavailable:", error);
        setStatus("error");
      } finally {
        window.clearTimeout(slowTimer);
        setSlow(false);
      }
    })();
  }, [version]);

  return { status, index, slow, load };
}
