"use client";

import { useId, useRef, type ReactNode } from "react";
import { useBodyScrollLock, useFocusTrap } from "@/lib/hooks";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Initial focus on Cancel: the safe choice for a destructive action.
  useFocusTrap(panelRef, open, {
    onEscape: onCancel,
    initialFocus: cancelRef,
    returnFocus,
  });
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="animate-fade-in bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="animate-fade-in bg-surface border-border relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div id={descriptionId} className="text-muted mt-2 text-sm">
          {description}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="border-border hover:bg-surface-hover h-11 rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-danger text-danger-foreground h-11 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
