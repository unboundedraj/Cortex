import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

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
      <SiteHeader start={headerStart} />
      <div className="flex flex-1">
        {sidebar}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
