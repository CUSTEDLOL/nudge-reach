"use client";

import { useRef, useState } from "react";
import { gsap, motionAllowed, useGSAP } from "./gsap";

const WORD = "NUDGE";
/** One brand glyph per letter slot — typed in first, then flipped into
 *  the letter. Text glyphs only, so the UI font renders them everywhere. */
const ICONS = ["✳", "●", "✓", "₹", "✦"];

const TYPE_START = 0.3; // first icon lands
const TYPE_STEP = 0.18; // one icon at a time, metronome rhythm
const SWAP_START = 1.5; // first icon changes into its letter
const SWAP_STEP = 0.24; // strictly one conversion after another
const WIPE_AT = 3.1; // panel leaves

/**
 * Brand splash on hard loads of the landing page (the Sunday-style
 * opener, in green): one icon per letter slot types in left-to-right,
 * each icon flips into its letter of the wordmark, then the panel
 * wipes upward to reveal the hero. Gated to `.jsm` — no JS or reduced
 * motion means it never covers the content at all. The hero delays its
 * own intro while this is on stage (it checks #nudge-splash).
 */
export function Preloader() {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      if (!motionAllowed()) {
        setDone(true);
        return;
      }
      const chars = gsap.utils.toArray<HTMLElement>(".splash-ch");
      const tl = gsap.timeline({ onComplete: () => setDone(true) });

      chars.forEach((el, i) => {
        // Typed in: one icon at a time — a crisp mechanical tick, no bounce.
        tl.fromTo(
          el,
          { autoAlpha: 0, scale: 0.7, y: 10 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.14, ease: "power4.out" },
          TYPE_START + i * TYPE_STEP
        );

        // The conversion: once every icon is on stage, each slot plainly
        // CHANGES into its letter, one by one — a hard mechanical swap
        // with only a micro-tick so it reads as intent, not a glitch.
        const at = SWAP_START + i * SWAP_STEP;
        tl.call(
          () => {
            el.textContent = WORD[i];
            // Icons render in the UI font (full glyph coverage); once a slot
            // becomes a letter, flip it to the playful caricature face.
            el.classList.add("is-letter");
          },
          undefined,
          at
        ).fromTo(
          el,
          { scale: 0.9 },
          { scale: 1, duration: 0.12, ease: "power3.out" },
          at
        );
      });

      // Hold the settled wordmark a beat, then the wipe.
      tl.to(".splash-word", { autoAlpha: 0, y: -30, duration: 0.3, ease: "power2.in" }, WIPE_AT - 0.08)
        .to(ref.current, { yPercent: -100, duration: 0.85, ease: "power4.inOut" }, WIPE_AT);
    },
    { scope: ref }
  );

  if (done) return null;

  return (
    <div
      id="nudge-splash"
      ref={ref}
      className="ns-splash fixed inset-0 z-[200] items-center justify-center bg-brand-500"
      aria-hidden
    >
      <p className="splash-word font-logo text-4xl font-extrabold tracking-[0.01em] text-white sm:text-5xl">
        {ICONS.map((icon, i) => (
          <span key={i} className="splash-ch inline-block w-[0.82em] text-center">
            {icon}
          </span>
        ))}
      </p>
    </div>
  );
}
