"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Landing } from "@/components/landing";

const ENTERED_KEY = "cortex-entered";
const ENTERED_ATTR = "data-entered";

export default function Home() {
  // Both the server render and the first client render start from `false`
  // so hydration never mismatches structurally. The inline script in
  // app/layout.tsx already set data-entered + hid .landing-overlay via CSS
  // for returning visitors before this ever painted, so the effect below
  // just finishes the unmount a beat later — invisibly.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (document.documentElement.getAttribute(ENTERED_ATTR) === "true") {
      // Deliberate: this corrects render state from a client-only source
      // (the attribute the anti-flash script set) rather than delaying a
      // prop/state change, which is exactly what a lazy useState
      // initializer can't safely do here without mismatching the server
      // render structurally (Landing present vs. absent).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntered(true);
    }
  }, []);

  const handleEnter = useCallback(() => {
    setEntered(true);
    document.documentElement.setAttribute(ENTERED_ATTR, "true");
    try {
      window.localStorage.setItem(ENTERED_KEY, "true");
    } catch {
      // Storage unavailable (private browsing, disabled, etc.) — the
      // landing will just show again next visit, which is fine.
    }
  }, []);

  return (
    <>
      <AppShell inert={!entered} />
      {!entered && <Landing onEnter={handleEnter} />}
    </>
  );
}
