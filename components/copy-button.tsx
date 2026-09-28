"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "failed";

/** For browsers/contexts without the async Clipboard API (e.g. non-HTTPS
 * origins). execCommand is deprecated but still the only fallback. */
function legacyCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("execCommand copy failed");
}

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let next: Status = "copied";
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy(text);
      }
    } catch {
      try {
        legacyCopy(text);
      } catch {
        next = "failed";
      }
    }
    setStatus(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2000);
  };

  const label =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Copy failed"
        : "Copy";

  return (
    <button
      type="button"
      onClick={copy}
      className="copy-button text-muted hover:text-foreground hover:bg-surface-hover inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-sans text-xs transition-colors"
    >
      {status === "copied" ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">{label}</span>
    </button>
  );
}
