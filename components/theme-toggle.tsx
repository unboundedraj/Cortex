"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="border-border bg-surface text-foreground hover:bg-surface-hover inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
    >
      {/* ThemeProvider resolves the real theme from the anti-flash script's
          class during hydration, so this can briefly differ from the
          server-rendered default — suppress the (harmless) mismatch warning
          rather than delaying the icon behind a mount effect. */}
      <span suppressHydrationWarning className="inline-flex">
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
