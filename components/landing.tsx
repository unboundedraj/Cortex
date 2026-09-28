"use client";

import { ArrowRight, BrainCircuit, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD = 320; // px-equivalent of scroll/drag before auto-entering
const POINTER_LERP = 0.06;
const PROGRESS_LERP = 0.16;
const PROGRESS_DECAY = 0.92;
const IDLE_DECAY_DELAY = 120; // ms since last wheel/touch input before decaying

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Landing({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const enteredRef = useRef(false);
  const triggerEnter = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    setLeaving(true);
  }, []);

  // Trigger the fade-in on first paint (a mount-time class flip, so the
  // browser has something to transition from).
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Lock body scroll while the landing is up; restore on dismissal/unmount.
  useEffect(() => {
    const { style } = document.body;
    const previous = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previous;
    };
  }, []);

  // Once the slide-up transition finishes, hand control back to the parent
  // so it can unmount us. A timeout fallback covers browsers/paths where
  // transitionend doesn't fire (e.g. the element is removed mid-transition).
  useEffect(() => {
    if (!leaving) return;
    const node = overlayRef.current;
    let fallback = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      onEnter();
    };
    if (!node) {
      finish();
      return;
    }
    // Both `translate` and `opacity` are transitioning (see .landing-overlay
    // in globals.css) and finish at the same time, so either one reaching
    // transitionend is enough — `done` just guards against firing twice.
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== node) return;
      finish();
    };
    node.addEventListener("transitionend", handleTransitionEnd);
    fallback = window.setTimeout(finish, 900);
    return () => {
      node.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [leaving, onEnter]);

  // Neural-network dot/line field, drawn on a canvas. Paused when the tab
  // is hidden, when the user prefers reduced motion (a single static frame
  // instead), and stopped entirely once the leave transition starts.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || leaving) return;

    const reduced = prefersReducedMotion();
    let width = 0;
    let height = 0;
    let points: { x: number; y: number; vx: number; vy: number }[] = [];
    let rafId = 0;
    let colors = readColors();

    function readColors() {
      const styles = getComputedStyle(document.documentElement);
      return {
        dot: styles.getPropertyValue("--foreground").trim() || "#888",
        line: styles.getPropertyValue("--border").trim() || "#888",
      };
    }

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = Math.round((width * height) / 16000);
      const count = clamp(density, 18, 70);
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      }));
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of points) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }
      }
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            ctx.globalAlpha = (1 - dist / 140) * 0.35;
            ctx.strokeStyle = colors.line;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[j].x, points[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = colors.dot;
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      draw();
      if (!reduced) rafId = requestAnimationFrame(frame);
    }

    resize();
    frame();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      colors = readColors();
      if (reduced) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    function handleVisibility() {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        rafId = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [leaving]);

  // Parallax (pointer + scroll/drag) and the scroll/swipe-past-threshold
  // auto-enter. Skipped under reduced motion beyond the threshold detection
  // itself, since that's a navigation affordance rather than decoration.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || leaving) return;

    const reduced = prefersReducedMotion();

    const pointerTarget = { x: 0, y: 0 };
    const pointerCurrent = { x: 0, y: 0 };
    let progressTarget = 0;
    let progressCurrent = 0;
    let lastInputAt = 0;
    let touchStartY = 0;
    let rafId = 0;

    function handleMouseMove(event: MouseEvent) {
      pointerTarget.x = event.clientX / window.innerWidth - 0.5;
      pointerTarget.y = event.clientY / window.innerHeight - 0.5;
    }

    function registerScrollIntent(delta: number) {
      lastInputAt = performance.now();
      progressTarget = clamp(progressTarget + delta / SCROLL_THRESHOLD, 0, 1.2);
      if (progressTarget >= 1) triggerEnter();
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      registerScrollIntent(event.deltaY);
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? 0;
    }

    function handleTouchMove(event: TouchEvent) {
      event.preventDefault();
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      lastInputAt = performance.now();
      progressTarget = clamp(
        (touchStartY - currentY) / SCROLL_THRESHOLD,
        0,
        1.2,
      );
      if (progressTarget >= 1) triggerEnter();
    }

    function handleTouchEnd() {
      if (progressTarget < 1) progressTarget = 0;
    }

    if (!reduced) window.addEventListener("mousemove", handleMouseMove);
    overlay.addEventListener("wheel", handleWheel, { passive: false });
    overlay.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    overlay.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    overlay.addEventListener("touchend", handleTouchEnd);

    function tick() {
      if (reduced) return; // threshold detection above is enough

      if (
        progressTarget < 1 &&
        performance.now() - lastInputAt > IDLE_DECAY_DELAY
      ) {
        progressTarget *= PROGRESS_DECAY;
      }

      pointerCurrent.x = lerp(pointerCurrent.x, pointerTarget.x, POINTER_LERP);
      pointerCurrent.y = lerp(pointerCurrent.y, pointerTarget.y, POINTER_LERP);
      progressCurrent = lerp(progressCurrent, progressTarget, PROGRESS_LERP);

      if (orbsRef.current) {
        const ty = pointerCurrent.y * 10 + progressCurrent * 14;
        const tx = pointerCurrent.x * 10;
        orbsRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
      if (canvasWrapRef.current) {
        const ty = pointerCurrent.y * 18 + progressCurrent * 26;
        const tx = pointerCurrent.x * 18;
        canvasWrapRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
      if (contentRef.current) {
        const ty = pointerCurrent.y * 6 - progressCurrent * 34;
        const scale = 1 - progressCurrent * 0.08;
        const opacity = clamp(1 - progressCurrent * 0.75, 0, 1);
        contentRef.current.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
        contentRef.current.style.opacity = String(opacity);
      }

      rafId = requestAnimationFrame(tick);
    }
    if (!reduced) rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      overlay.removeEventListener("wheel", handleWheel);
      overlay.removeEventListener("touchstart", handleTouchStart);
      overlay.removeEventListener("touchmove", handleTouchMove);
      overlay.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(rafId);
    };
  }, [leaving, triggerEnter]);

  return (
    <div
      ref={overlayRef}
      className={`landing-overlay bg-background fixed inset-0 z-50 h-dvh w-full overflow-hidden ${
        leaving ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        ref={orbsRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 will-change-transform"
      >
        <div
          className="landing-orb absolute top-[-15%] left-[-10%] h-[55vmax] w-[55vmax] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            opacity: 0.22,
          }}
        />
        <div
          className="landing-orb absolute right-[-15%] bottom-[-15%] h-[50vmax] w-[50vmax] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--foreground) 0%, transparent 70%)",
            opacity: 0.1,
            animationDelay: "-9s",
            animationDuration: "26s",
          }}
        />
        <div
          className="landing-orb absolute top-1/3 right-[10%] h-[24vmax] w-[24vmax] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            opacity: 0.14,
            animationDelay: "-15s",
            animationDuration: "18s",
          }}
        />
      </div>

      <div
        ref={canvasWrapRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 will-change-transform"
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* Vignette: grounds the content and hides the canvas/orb edges. */}
      <div
        aria-hidden="true"
        className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t to-transparent sm:h-64"
      />

      {/*
        Two layers, deliberately: this outer one owns the declarative
        mount-in fade (a CSS transition keyed off `mounted`), while the
        inner `contentRef` div is mutated imperatively every frame by the
        parallax/drag effect above. Putting both on one element would have
        the per-frame inline styles stomp the mount transition's classes.
      */}
      <div
        className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center transition-opacity duration-700 ease-out ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={contentRef}
          className="flex flex-col items-center gap-7 will-change-transform"
        >
          <div className="border-border bg-surface/70 text-muted inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-widest uppercase backdrop-blur-sm">
            <BrainCircuit
              className="text-accent h-3.5 w-3.5"
              aria-hidden="true"
            />
            Personal knowledge base
          </div>

          <p
            className="font-heading text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl"
            style={{
              filter:
                "drop-shadow(0 0 46px color-mix(in oklab, var(--accent) 40%, transparent))",
            }}
          >
            Cortex
          </p>

          <p className="text-muted max-w-xs text-base sm:max-w-md sm:text-lg">
            A quiet place to think in writing.
          </p>

          <button
            ref={buttonRef}
            type="button"
            onClick={triggerEnter}
            className="bg-accent text-accent-foreground shadow-accent/20 group mt-3 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium shadow-lg transition-all duration-200 hover:scale-[1.03] hover:opacity-90 active:scale-95 sm:text-base"
          >
            Enter Cortex
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div
        className={`text-muted pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-xs transition-opacity duration-700 ease-out sm:bottom-9 ${
          mounted ? "opacity-70" : "opacity-0"
        }`}
      >
        <span className="tracking-widest uppercase">Scroll to enter</span>
        <ChevronDown
          className="landing-hint-bounce h-4 w-4"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
