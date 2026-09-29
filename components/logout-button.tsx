"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      // Full navigation, deliberately not router.push(): the very next
      // request to a protected route needs proxy.ts to see the cleared
      // cookie, and a hard load guarantees that rather than depending on
      // client-router fetch/cookie-jar timing.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-muted hover:text-foreground hover:bg-surface-hover -mr-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
