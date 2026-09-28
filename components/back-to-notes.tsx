"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LAST_LIST_URL_KEY } from "@/lib/routes";

/** Returns to the notes list with its last search/filter state, falling
 * back to "/" (e.g. when the note was opened directly in a new tab). */
export function BackToNotes() {
  const router = useRouter();

  return (
    <Link
      href="/"
      onClick={(event) => {
        let url: string | null = null;
        try {
          url = window.sessionStorage.getItem(LAST_LIST_URL_KEY);
        } catch {
          // Storage unavailable — plain "/" is fine.
        }
        if (url && url.startsWith("/") && url !== "/") {
          event.preventDefault();
          router.push(url);
        }
      }}
      className="text-muted hover:text-foreground inline-flex h-11 items-center gap-2 text-sm"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to notes
    </Link>
  );
}
