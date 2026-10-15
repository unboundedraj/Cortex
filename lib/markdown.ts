import "server-only";
import { cache } from "react";
import { renderMarkdown, type NoteHeading } from "@/lib/markdown-pipeline";

export type { NoteHeading };

/** Parsed + sanitized markdown, cached so the page and renderer share one
 * parse per request. */
export const processMarkdown = cache(renderMarkdown);

const WORDS_PER_MINUTE = 220;

export function readingTimeMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
