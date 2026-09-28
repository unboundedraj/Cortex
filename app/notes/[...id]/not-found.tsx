import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NoteNotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wordmark="link" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="border-border bg-surface flex w-full max-w-md flex-col items-center rounded-2xl border px-6 py-12 text-center">
          <div className="bg-background text-muted mb-4 grid h-12 w-12 place-items-center rounded-full">
            <FileQuestion className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold">Note not found</h1>
          <p className="text-muted mt-2 text-sm">
            It may have been moved, renamed or deleted.
          </p>
          <Link
            href="/"
            className="bg-accent text-accent-foreground mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Back to all notes
          </Link>
        </div>
      </main>
    </div>
  );
}
