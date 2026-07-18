"use client";

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { gsap, motionAllowed, useGSAP } from "./gsap";

const LOGO_W = 1570;
const LOGO_H = 334;

const FILL_START = 0.2;
const FILL_DURATION = 1.35;
const HOLD_UNTIL = FILL_START + FILL_DURATION + 0.35;
const MOVE_DURATION = 0.75;

/**
 * Brand splash on hard loads of the landing page: a white screen with the
 * NUDGE wordmark centred in black, filling with brand green like water rising
 * bottom→top (a soft-edged mask plus a drifting wave riding the surface).
 * Once full, the mark shrinks and slides into the EXACT spot of the real
 * navbar logo (measured via getBoundingClientRect — a shared-element hand-off,
 * so the splash logo visibly *becomes* the navbar logo rather than
 * cross-fading). Gated to `.jsm`: no JS or reduced motion means it never
 * covers content at all. The hero delays its own intro while this is on stage
 * (it checks #nudge-splash).
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
      const fill = wrapper?.querySelector<HTMLElement>(".splash-logo-fill");
      const surface = wrapper?.querySelector<HTMLElement>(".splash-surface");
      const target = document.querySelector<HTMLElement>("#nav-logo-target img");
      if (!wrapper || !fill || !surface || !target) {
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

      // The water rises: the mask climbs while the wave surface rides it.
      tl.to(
        fill,
        { "--fill": 100, duration: FILL_DURATION, ease: "power1.inOut" },
        FILL_START
      )
        .fromTo(
          surface,
          { bottom: "0%", autoAlpha: 1 },
          { bottom: "100%", duration: FILL_DURATION, ease: "power1.inOut" },
          FILL_START
        )
        .to(surface, { autoAlpha: 0, duration: 0.25 }, FILL_START + FILL_DURATION - 0.2);

      // Full — shrink/slide into the real navbar logo, then lift the screen.
      tl.to(
        wrapper,
        { x: dx, y: dy, scale, duration: MOVE_DURATION, ease: "power3.inOut" },
        HOLD_UNTIL
      ).to(
        ref.current,
        { autoAlpha: 0, duration: 0.45, ease: "power2.in" },
        HOLD_UNTIL + MOVE_DURATION - 0.35
      );
    },
    { scope: ref }
  );

  if (done) return null;

  return (
    <div
      id="nudge-splash"
      ref={ref}
      className="ns-splash fixed inset-0 z-[200] grid place-items-center bg-white"
      aria-hidden
    >
      <div ref={wrapRef} className="w-[min(68vw,32rem)]">
        <div className="relative">
          {/* the empty vessel — the wordmark in black */}
          <Image
            src="/logo-mark.png"
            alt=""
            width={LOGO_W}
            height={LOGO_H}
            priority
            className="splash-logo-outline block h-auto w-full"
          />
          {/* the water — brand green, revealed bottom→top */}
          <Image
            src="/logo-mark.png"
            alt="Nudge"
            width={LOGO_W}
            height={LOGO_H}
            priority
            className="splash-logo-fill absolute inset-0 block h-auto w-full"
            style={{ "--fill": 0 } as CSSProperties}
          />
          {/* the surface — a drifting wave riding the waterline, clipped to
              the letterforms so it never strikes through the wordmark */}
          <span
            className="splash-logo-mask pointer-events-none absolute inset-0 block"
            aria-hidden
          >
            <span className="splash-surface absolute inset-x-0 h-[7%] -translate-y-1/2 overflow-hidden opacity-0">
              <svg
                viewBox="0 0 240 12"
                preserveAspectRatio="none"
                className="splash-wave h-full w-[200%]"
              >
                <path
                  d="M0 6 C 15 1, 45 1, 60 6 S 105 11, 120 6 S 165 1, 180 6 S 225 11, 240 6 L 240 12 L 0 12 Z"
                  fill="#37ce86"
                />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
