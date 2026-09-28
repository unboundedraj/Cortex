"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION = 2800;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(null), TOAST_DURATION);
  }, []);

  return { message, show };
}

/** The live region stays mounted so screen readers reliably announce each
 * new message. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {message && (
        <div className="animate-fade-in bg-foreground text-background rounded-full px-4 py-2.5 text-sm font-medium shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
