"use client";

import { Check, GitCommitHorizontal, LoaderCircle } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { useBodyScrollLock, useFocusTrap } from "@/lib/hooks";

export function CommitDialog({
  open,
  message,
  onMessageChange,
  pending,
  error,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  open: boolean;
  message: string;
  onMessageChange: (message: string) => void;
  pending: boolean;
  error: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const cancel = () => {
    if (!pending) onCancel();
  };

  useFocusTrap(panelRef, open, {
    onEscape: cancel,
    initialFocus: textareaRef,
    returnFocus,
  });
  useBodyScrollLock(open);

  if (!open) return null;

  const empty = !message.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="animate-fade-in bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={cancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={pending}
        className="animate-fade-in bg-surface border-border relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
      >
        <h2
          id={titleId}
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <GitCommitHorizontal className="h-5 w-5" aria-hidden="true" />
          Commit to GitHub
        </h2>
        <p className="text-muted mt-1 text-sm">
          This saves the note straight to your notes repo.
        </p>

        <label htmlFor={fieldId} className="mt-4 block text-sm font-medium">
          Commit message
        </label>
        <textarea
          id={fieldId}
          ref={textareaRef}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (!pending && !empty) onConfirm();
            }
          }}
          disabled={pending}
          rows={3}
          maxLength={500}
          className="border-border bg-background mt-1.5 w-full resize-y rounded-xl border px-3 py-2 text-sm disabled:opacity-60"
        />

        {error && (
          <div
            role="alert"
            className="border-danger/40 text-danger mt-3 rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="border-border hover:bg-surface-hover h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || empty}
            className="bg-accent text-accent-foreground inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? "Committing…" : "Commit"}
          </button>
        </div>
      </div>
    </div>
  );
}
