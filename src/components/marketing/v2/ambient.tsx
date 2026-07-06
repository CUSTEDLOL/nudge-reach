"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, motionAllowed } from "./gsap";
import { shift, shiftClock } from "./progress";

/**
 * The ambient layer: film grain over everything, a faint emerald cursor aura
 * (fine pointers only), and the day-rail — a fixed "shift clock" on the right
 * edge whose time runs from 11:47 PM to 9:00 AM as you scroll the page
 * (driven by the shared shift refs). The page is one shift; the rail makes
 * that literal.
 */

export function Grain() {
  return (
    <div
      aria-hidden
      className="v2-grain pointer-events-none fixed inset-0 z-[80] opacity-[0.055] mix-blend-overlay"
      style={{
        // If the founder drops a real 4K grain still it layers on top of the
        // built-in SVG turbulence; a 404 simply leaves the fallback visible.
        backgroundImage: `url(/landing/a4-grain.png), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
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
      className="pointer-events-none fixed left-0 top-0 z-[2] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 mix-blend-screen transition-opacity duration-500"
      style={{
        background:
          "radial-gradient(closest-side, rgba(6,193,103,0.09), transparent 70%)",
      }}
    />
  );
}

export function DayRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!motionAllowed()) return;
    const rail = railRef.current;
    const dot = dotRef.current;
    const label = timeRef.current;
    if (!rail || !dot || !label) return;

    const st = ScrollTrigger.create({
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      onUpdate(self) {
        const track = rail.clientHeight - dot.clientHeight;
        gsap.set(dot, { y: self.progress * track });
        label.textContent = shiftClock(shift.story, shift.after);
      },
    });
    label.textContent = shiftClock(0, 0);
    return () => st.kill();
  }, []);

  return (
    <div
      aria-hidden
      className="v2-dayrail fixed right-5 top-1/2 z-[60] hidden h-[42vh] -translate-y-1/2 flex-col items-center lg:flex"
    >
      <span className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 day:text-ink/40">
        Shift
      </span>
      <div ref={railRef} className="relative w-px flex-1 bg-white/10 day:bg-ink/15">
        <div
          ref={dotRef}
          className="absolute -left-[3.5px] top-0 flex items-center"
        >
          <span className="h-[7px] w-[7px] rounded-full bg-brand-400 shadow-[0_0_12px_rgba(55,206,134,0.9)]" />
          <span
            ref={timeRef}
            className="absolute right-3 whitespace-nowrap font-mono text-[10px] tracking-[0.08em] text-brand-200/80 day:text-brand-700"
          />
        </div>
      </div>
      <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 day:text-ink/40">
        9 AM
      </span>
    </div>
  );
}
