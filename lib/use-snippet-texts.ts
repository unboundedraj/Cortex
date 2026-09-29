import { useEffect, useRef, useState } from "react";

const SETTLE_MS = 400;

/**
 * Plain body text for the given note ids, fetched lazily for result
 * snippets. The index doesn't carry bodies (that would dominate its size),
 * so the text is fetched here instead — but only:
 * - after typing pauses for 400 ms (continuous typing makes no requests),
 * - for ids not fetched before (each note's text at most once per session),
 * - in one batched request per settled query.
 */
export function useSnippetTexts(
  version: string,
  ids: string[],
  /** Changes on every keystroke (the query). Part of the effect's deps so
   * the settle timer restarts per keystroke — keying on `ids` alone isn't
   * enough, since "inf" -> "infe" -> "infer" often yield the same results
   * and the timer would fire mid-word. */
  settleKey: string,
): ReadonlyMap<string, string> {
  const [texts, setTexts] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const requested = useRef(new Set<string>());
  const key = ids.join("\u0000");

  useEffect(() => {
    const missing = (key ? key.split("\u0000") : []).filter(
      (id) => !requested.current.has(id),
    );
    if (missing.length === 0) return;

    const timer = window.setTimeout(async () => {
      for (const id of missing) requested.current.add(id);
      const params = new URLSearchParams({ v: version });
      for (const id of missing) params.append("id", id);
      let fetched: Record<string, string> = {};
      try {
        const response = await fetch(`/api/search-text?${params}`);
        if (response.ok) fetched = await response.json();
      } catch {
        // No snippet for these results; the list itself is unaffected.
      }
      setTexts((prev) => {
        const next = new Map(prev);
        for (const id of missing) next.set(id, fetched[id] ?? "");
        return next;
      });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [key, version, settleKey]);

  return texts;
}
