import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Cortex",
  description: "A personal note-taking app.",
};

// Applies the persisted theme, and marks returning visitors as already
// having entered the landing, before React hydrates — so there's no
// light-mode flash on a dark-mode reload, and no landing-overlay flash for
// someone who has already seen it (see components/landing.tsx and the
// `html[data-entered="true"] .landing-overlay` rule in globals.css).
const themeInitScript = `(function () {
  try {
    var stored = window.localStorage.getItem("cortex-theme");
    var theme = stored === "dark" ? "dark" : "light";
    document.documentElement.classList.add(theme);
  } catch (e) {
    document.documentElement.classList.add("light");
  }
  try {
    if (window.localStorage.getItem("cortex-entered") === "true") {
      document.documentElement.setAttribute("data-entered", "true");
    }
  } catch (e) {
    // localStorage unavailable — the landing will just show every visit.
  }
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${orbitron.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
