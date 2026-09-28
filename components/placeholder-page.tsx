import type { ReactNode } from "react";
import { BackToNotes } from "@/components/back-to-notes";

/** Temporary scaffolding for routes whose real UI comes in later steps. */
export function PlaceholderPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6 sm:px-6">
      <BackToNotes />
      <div className="border-border bg-surface mt-6 rounded-2xl border p-6">
        <p className="text-muted text-xs font-medium tracking-widest uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-xl font-semibold wrap-break-word">{title}</h1>
        <div className="text-muted mt-3 text-sm">{children}</div>
      </div>
    </main>
  );
}
