"use client";

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { gsap, motionAllowed, useGSAP } from "./gsap";

const LOGO_W = 1570;
const LOGO_H = 334;

const FILL_START = 0.15;
const FILL_DURATION = 1.1;
const HOLD_UNTIL = FILL_START + FILL_DURATION + 0.3; // ~1.55s
const COLOR_DURATION = 0.4;
const MOVE_DURATION = 0.75;

/**
 * Brand splash on hard loads of the landing page: the big white logo mark,
 * off-centre (not a hero headline), fills bottom→top like liquid rising
 * (a soft-edged mask + a travelling waterline glow) — then it turns from
 * white to the brand green, and shrinks/slides into the EXACT spot of the
 * real navbar logo (measured via getBoundingClientRect, a shared-element
 * hand-off — the splash logo visibly becomes the navbar logo, not a separate
 * fade). Gated to `.jsm` — no JS or reduced motion means it never covers the
 * content at all. The hero delays its own intro while this is on stage (it
 * checks #nudge-splash).
 */
export function Preloader() {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      if (!motionAllowed()) {
        setDone(true);
        return;
      }
      const wrapper = wrapRef.current;
      const whiteImg = wrapper?.querySelector<HTMLElement>(".splash-logo-white");
      const greenImg = wrapper?.querySelector<HTMLElement>(".splash-logo-green");
      const waterline = wrapper?.querySelector<HTMLElement>(".splash-waterline");
      const target = document.querySelector<HTMLElement>("#nav-logo-target img");
      if (!wrapper || !whiteImg || !greenImg || !waterline || !target) {
        setDone(true);
        return;
      }

      // Measure now, before anything moves — the shared-element target.
      const startRect = wrapper.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scale = targetRect.width / startRect.width;
      const dx = targetRect.left - startRect.left;
      const dy = targetRect.top - startRect.top;
      gsap.set(wrapper, { transformOrigin: "top left" });

      const tl = gsap.timeline({ onComplete: () => setDone(true) });

      // Liquid fill, bottom → top (mask reveal + a travelling glow riding
      // the waterline).
      tl.to(whiteImg, { "--fill": 100, duration: FILL_DURATION, ease: "power2.inOut" }, FILL_START)
        .fromTo(
          waterline,
          { bottom: "0%", autoAlpha: 1 },
          { bottom: "100%", duration: FILL_DURATION, ease: "power2.inOut" },
          FILL_START
        )
        .to(waterline, { autoAlpha: 0, duration: 0.2 }, FILL_START + FILL_DURATION - 0.15);

      // White → green, then shrink/slide into the real navbar logo's spot.
      tl.to(greenImg, { autoAlpha: 1, duration: COLOR_DURATION, ease: "power1.inOut" }, HOLD_UNTIL)
        .to(whiteImg, { autoAlpha: 0, duration: COLOR_DURATION, ease: "power1.inOut" }, HOLD_UNTIL)
        .to(
          wrapper,
          { x: dx, y: dy, scale, duration: MOVE_DURATION, ease: "power3.inOut" },
          HOLD_UNTIL
        )
        .to(ref.current, { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, HOLD_UNTIL + MOVE_DURATION - 0.35);
    },
    { scope: ref }
  );

  if (done) return null;

  return (
    <div id="nudge-splash" ref={ref} className="ns-splash fixed inset-0 z-[200] bg-night" aria-hidden>
      <div
        ref={wrapRef}
        className="absolute left-6 top-[34%] w-[min(72vw,42rem)] sm:left-10"
      >
        <div className="relative">
          <Image
            src="/logo-mark-white.png"
            alt=""
            width={LOGO_W}
            height={LOGO_H}
            priority
            className="splash-logo-white block h-auto w-full"
            style={{ "--fill": 0 } as CSSProperties}
          />
          <Image
            src="/logo-mark.png"
            alt="Nudge"
            width={LOGO_W}
            height={LOGO_H}
            priority
            className="splash-logo-green absolute inset-0 block h-auto w-full opacity-0"
          />
          {/* the "water surface" — a soft glow riding the fill line */}
          <span
            className="splash-waterline pointer-events-none absolute inset-x-0 h-6 -translate-y-1/2 bg-white/70 blur-md"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
