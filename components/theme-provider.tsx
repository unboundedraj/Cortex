"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "cortex-theme";
const DEFAULT_THEME: Theme = "light";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start from the coded default so the server render and the
  // client's FIRST (hydration) render agree exactly. Reading the DOM class
  // here instead — which is what the anti-flash script in app/layout.tsx
  // already set — would only match the server when the visitor's real
  // theme happens to equal DEFAULT_THEME; otherwise every theme-dependent
  // consumer (e.g. ThemeToggle's icon/aria-label) hydration-mismatches,
  // which React can't recover from cleanly (suppressHydrationWarning only
  // covers text-content mismatches, not swapped elements/attributes) and
  // ends up discarding and client-rendering a much larger chunk of the
  // tree than just this component.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Correct to the real persisted theme right after mount — a normal
  // post-hydration state update, not a hydration concern.
  useEffect(() => {
    const real: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    if (real !== DEFAULT_THEME) {
      // Deliberate hydration-safe correction (see comment on `theme`
      // above), not a derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(real);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
