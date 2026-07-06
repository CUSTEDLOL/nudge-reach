"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Daylight-zone wrapper: full-bleed sections that ride the scroll like
 * Apple product pages — each one rises and settles as it enters (scrubbed,
 * not one-shot, so it plays forward AND backward), then drifts gently on
 * its way out. Sections keep their own backgrounds; no card chrome.
 */
export function DaySection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed() || !ref.current) return;
      const el = ref.current;
      gsap.fromTo(
        el,
        { autoAlpha: 0.3, y: 110, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 96%", end: "top 45%", scrub: 0.5 },
        }
      );
      gsap.to(el, {
        yPercent: -2.5,
        ease: "none",
        scrollTrigger: { trigger: el, start: "bottom 55%", end: "bottom top", scrub: true },
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={cn("v2-reveal", className)}>
      {children}
    </div>
  );
}
