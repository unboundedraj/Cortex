import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The real app, always mounted underneath the landing overlay. `inert`
 * keeps it out of the tab order and off-limits to assistive tech while the
 * landing sits on top of it.
 */
export function AppShell({
  children,
  inert = false,
}: {
  children?: ReactNode;
  inert?: boolean;
}) {
  return (
    <div
      inert={inert}
      aria-hidden={inert ? "true" : undefined}
      className="flex min-h-dvh flex-col"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <h1 className="font-heading text-xl font-bold tracking-wide sm:text-2xl">
          Cortex
        </h1>
        <ThemeToggle />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
