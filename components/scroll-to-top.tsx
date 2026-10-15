"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef } from "react";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScrollToTop() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      frameRef.current = null;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      const shouldShow = max > 0 && scrollY > 200;
      buttonRef.current?.classList.toggle("is-visible", shouldShow);
      if (buttonRef.current) {
        if (!shouldShow && document.activeElement === buttonRef.current) {
          buttonRef.current.blur();
        }
        buttonRef.current.tabIndex = shouldShow ? 0 : -1;
        buttonRef.current.setAttribute("aria-hidden", String(!shouldShow));
      }
      ringRef.current?.style.setProperty(
        "stroke-dashoffset",
        String(CIRCUMFERENCE * (1 - progress)),
      );
      if (progressRef.current) {
        progressRef.current.textContent = `${Math.round(progress * 100)}% read`;
      }
    };
    const schedule = () => {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(update);
      }
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="scroll-to-top"
      aria-label="Scroll to top"
      aria-hidden="true"
      tabIndex={-1}
      onClick={() =>
        scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)")
            ? "instant"
            : "smooth",
        })
      }
    >
      <svg
        className="scroll-to-top__ring"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle className="scroll-to-top__track" cx="24" cy="24" r={RADIUS} />
        <circle
          ref={ringRef}
          className="scroll-to-top__progress"
          cx="24"
          cy="24"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
        />
      </svg>
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
      <span ref={progressRef} className="sr-only">
        0% read
      </span>
    </button>
  );
}
