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
      className="border-border bg-surface text-foreground hover:bg-surface-hover inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors sm:h-9 sm:w-9"
    >
      {/* ThemeProvider always starts at the coded default, matching the
          server exactly, then corrects to the real theme post-mount — so
          this can briefly swap icons right after load if the visitor's
          saved theme differs, but it never hydration-mismatches. */}
      <span className="inline-flex">
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
