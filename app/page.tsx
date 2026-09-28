import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-wide sm:text-3xl">
          Cortex
        </h1>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="text-muted text-sm font-medium tracking-wide uppercase">
          Design preview
        </h2>

        <div className="border-border bg-surface rounded-xl border p-6">
          <p className="text-sm font-medium">Surface card</p>
          <p className="text-muted mt-2 text-sm">
            Surfaces sit on top of the background — used for cards, panels and
            bars.
          </p>
        </div>

        <div className="border-border bg-surface hover:bg-surface-hover flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-medium">On the nature of memory</p>
            <p className="text-muted text-xs">Sep 28, 2026</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs font-medium">
              philosophy
            </span>
            <span className="border-border text-muted rounded-full border px-2.5 py-1 text-xs font-medium">
              draft
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Primary action
          </button>
          <button
            type="button"
            className="hover:bg-surface-hover rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Ghost button
          </button>
          <button
            type="button"
            aria-label="Add note"
            title="Add note"
            className="border-border bg-surface hover:bg-surface-hover inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search notes..."
          className="border-border bg-surface text-foreground placeholder:text-muted w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
        />

        <p className="text-muted max-w-md text-sm">
          Muted text is used for secondary information like timestamps, helper
          text and metadata.
        </p>
      </section>
    </div>
  );
}
