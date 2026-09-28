import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/** Keeps the latest callback in a ref so effects don't re-run when a parent
 * passes a new inline function. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Modal focus handling: moves focus into `containerRef` when `active`,
 * cycles Tab/Shift+Tab within it, calls `onEscape` on Escape, and on
 * deactivation restores focus to `returnFocus()` (or whatever was focused
 * when it opened, if that element is still in the document).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: {
    onEscape?: () => void;
    initialFocus?: RefObject<HTMLElement | null>;
    returnFocus?: () => HTMLElement | null;
  } = {},
) {
  const optionsRef = useLatest(options);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { returnFocus } = optionsRef.current;
    const initial =
      optionsRef.current.initialFocus?.current ??
      focusableIn(container)[0] ??
      container;
    initial.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        optionsRef.current.onEscape?.();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = returnFocus?.() ?? previouslyFocused;
      if (target?.isConnected) target.focus();
    };
  }, [active, containerRef, optionsRef]);
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { style } = document.body;
    const previous = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previous;
    };
  }, [active]);
}

/** Non-modal dismissal: pointer-down outside `ref` or Escape. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: (reason: "outside" | "escape") => void,
) {
  const onDismissRef = useLatest(onDismiss);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismissRef.current("outside");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismissRef.current("escape");
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, ref, onDismissRef]);
}
