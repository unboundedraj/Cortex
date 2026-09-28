import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const wordmarkClass =
  "font-heading truncate text-xl font-bold tracking-wide sm:text-2xl";

/**
 * The app header. On the list the wordmark is the page's <h1>; elsewhere
 * (e.g. the note view, whose <h1> is the note title) it's a link home.
 */
export function SiteHeader({
  start,
  wordmark = "heading",
}: {
  start?: ReactNode;
  wordmark?: "heading" | "link";
}) {
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-3 backdrop-blur sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-1.5">
        {start}
        {wordmark === "heading" ? (
          <h1 className={wordmarkClass}>Cortex</h1>
        ) : (
          <Link href="/" className={`${wordmarkClass} rounded-md`}>
            Cortex
          </Link>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
