"use client";

import { useEffect, useRef } from "react";
import { gsap, motionAllowed } from "./gsap";

/**
 * The ambient layer: film grain over everything, a faint emerald cursor aura
 * (fine pointers only). Chapter progress now lives inside the pinned browser
 * showcase, where it has context, instead of following unrelated sections.
 */

export function Grain() {
  return (
    <div
      aria-hidden
      className="v2-grain pointer-events-none fixed inset-0 z-[80] opacity-[0.055] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

export function CursorAura() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!motionAllowed()) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.55, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      el.style.opacity = "1";
    };
    const leave = () => {
      el.style.opacity = "0";
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[2] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 mix-blend-multiply transition-opacity duration-500"
      style={{
        background:
          "radial-gradient(closest-side, rgba(6,193,103,0.06), transparent 70%)",
      }}
    />
  );
}
