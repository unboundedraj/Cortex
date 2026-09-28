"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { arrivedFromList } from "@/lib/list-navigation";

/**
 * If this page was reached from the notes list, go back in history so the
 * list's search/filters are restored. Otherwise (direct link, reload, new
 * tab) it's a plain link to "/".
 */
export function BackToNotes({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <Link
      href="/"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (arrivedFromList()) {
          event.preventDefault();
          router.back();
        }
      }}
      className={`text-muted hover:text-foreground hover:bg-surface-hover -ml-2 inline-flex h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Link>
  );
}
