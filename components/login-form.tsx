"use client";

import { useState, type FormEvent } from "react";
import { resolveSafeRedirect } from "@/lib/safe-redirect";

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        setError(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? `Too many attempts. Try again in ${formatRetryAfter(retryAfter)}.`
            : "Too many attempts. Try again later.",
        );
        return;
      }

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message =
          data && typeof data === "object" && "message" in data
            ? String(data.message)
            : "Incorrect password";
        setError(message);
        return;
      }

      // useSearchParams() would need a Suspense boundary here; reading the
      // URL directly at submit time (an event handler, not render) avoids
      // that entirely since this value is never needed for initial render.
      const from = new URLSearchParams(window.location.search).get("from");
      const target = resolveSafeRedirect(from, window.location.origin);
      // A full navigation, not router.push: guarantees the request that
      // loads the destination carries the Set-Cookie response we just got,
      // rather than depending on client-router fetch/cookie-jar timing.
      window.location.href = target;
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <div className="border-border bg-surface rounded-2xl border p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-muted mt-1 text-sm">
          Enter the editor password to create or edit notes.
        </p>

        <label className="mt-5 block">
          <span className="text-muted text-xs font-medium tracking-widest uppercase">
            Password
          </span>
          <input
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border-border bg-background mt-1.5 h-11 w-full rounded-xl border px-3 text-sm"
          />
        </label>

        {error && (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="bg-accent text-accent-foreground mt-5 h-11 w-full rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
