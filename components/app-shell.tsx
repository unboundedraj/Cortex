import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The real app, always mounted underneath the landing overlay. `inert`
 * keeps it out of the tab order and off-limits to assistive tech while the
 * landing sits on top of it.
 */
export function AppShell({
  children,
  headerStart,
  sidebar,
  inert = false,
}: {
  children?: ReactNode;
  headerStart?: ReactNode;
  sidebar?: ReactNode;
  inert?: boolean;
}) {
  return (
    <div
      inert={inert}
      aria-hidden={inert ? "true" : undefined}
      className="flex min-h-dvh flex-col"
    >
      <header className="border-border bg-background/85 sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-3 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          {headerStart}
          <h1 className="font-heading truncate text-xl font-bold tracking-wide sm:text-2xl">
            Cortex
          </h1>
        </div>
        <ThemeToggle />
      </header>
      <div className="flex flex-1">
        {sidebar}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
