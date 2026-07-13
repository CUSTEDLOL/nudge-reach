"use client";

import { SmoothScroll } from "./smooth-scroll";
import { CursorAura, Grain } from "./ambient";

/**
 * The one client orchestrator for the Night Shift page:
 *  - Lenis smooth scroll (SmoothScroll)
 *  - the ambient grain + cursor aura layers
 * The chapter visuals are DOM (the WhatsApp phone in chapters/phone.tsx),
 * each scrubbed by its own ScrollTrigger — no WebGL world anymore.
 */
export function Experience() {
  return (
    <>
      <SmoothScroll />
      <Grain />
      <CursorAura />
    </>
  );
}
