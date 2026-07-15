"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, motionAllowed } from "./gsap";

/**
 * Lenis smooth scroll, synced to GSAP's ticker so ScrollTrigger scrubbing and
 * the inertia layer share one clock. Rules of engagement:
 *  - mounts ONLY under the motion gate (no-JS / reduced-motion → native scroll)
 *  - touch input stays native (syncTouch off) — phones keep platform physics
 *  - in-page anchors route through lenis.scrollTo so #links glide correctly
 *  - keyboard scrolling stays native; Lenis follows via the scroll event
 */
export function SmoothScroll() {
  useEffect(() => {
    if (!motionAllowed()) return;

    // Short duration: enough smoothing to keep the scrubbed sections silky,
    // close enough to 1:1 that the native scrollbar doesn't read as custom.
    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onClick = (e: MouseEvent) => {
      // Handle "#id" and same-page "/#id" links (the navbar uses the latter
      // so its anchors also work from /pricing and /faq).
      const anchor = (e.target as HTMLElement).closest?.(
        'a[href^="#"], a[href^="/#"]'
      );
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const id = href.slice(href.indexOf("#"));
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
