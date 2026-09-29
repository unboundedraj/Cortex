"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { useBodyScrollLock, useFocusTrap } from "@/lib/hooks";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  error,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  /** While true the dialog can't be dismissed and the confirm button shows
   * a spinner — prevents double submits and closing mid-request. */
  pending?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const cancel = () => {
    if (!pending) onCancel();
  };

  // Initial focus on Cancel: the safe choice for a destructive action.
  useFocusTrap(panelRef, open, {
    onEscape: cancel,
    initialFocus: cancelRef,
    returnFocus,
  });
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="animate-fade-in bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={cancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending}
        className="animate-fade-in bg-surface border-border relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div id={descriptionId} className="text-muted mt-2 text-sm">
          {description}
        </div>
        {error && (
          <div
            role="alert"
            className="border-danger/40 text-danger mt-4 rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            disabled={pending}
            className="border-border hover:bg-surface-hover h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-70 ${
              tone === "danger"
                ? "bg-danger text-danger-foreground"
                : "bg-accent text-accent-foreground"
            }`}
          >
            {pending && (
              <LoaderCircle
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
