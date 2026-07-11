"use client";

import { useRef } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ButtonLink } from "../button";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — 11:47 PM. The headline is server HTML (it IS the LCP element); the
 * persistent world (mounted by Experience) provides the sky behind it, so
 * this section is transparent. bg-mesh remains as the designed no-WebGL look.
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-eyebrow", { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
        .from(".hero-line", { yPercent: 112, duration: 1.1, stagger: 0.12 }, 0.15)
        .from(".hero-sub", { autoAlpha: 0, y: 18, duration: 0.8 }, 0.55)
        .from(".hero-ctas", { autoAlpha: 0, y: 16, duration: 0.8 }, 0.7)
        .from(".hero-ledger", { autoAlpha: 0, x: 36, rotate: 1.5, duration: 1 }, 0.48)
        .from(".hero-ledger-row", { autoAlpha: 0, x: 16, duration: 0.55, stagger: 0.08 }, 0.7)
        .from(".hero-cue", { autoAlpha: 0, duration: 0.9 }, 1.0);

      // Gentle drift as the hero scrolls away — depth without distraction.
      gsap.to(".hero-copy", {
        yPercent: -14,
        autoAlpha: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* White stays the canvas. The ink wash gives the type a focal plane. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 65% at 18% 38%, rgba(6,193,103,0.09), transparent 72%)",
        }}
      />

      <div className="hero-copy relative z-10 mx-auto grid w-full max-w-[100vw] grid-cols-[minmax(0,1fr)] items-center gap-12 overflow-hidden px-5 pb-24 pt-32 sm:px-8 lg:max-w-7xl lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)] lg:gap-16 lg:overflow-visible">
        <div className="min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-none">
          <p className="hero-eyebrow flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            On shift now · 11:47 PM
          </p>

          <h1 className="mt-7 font-display text-[clamp(2.65rem,7.2vw,6.7rem)] font-black leading-[0.91] tracking-[-0.055em] text-ink">
            <span className="block overflow-hidden pb-2">
              <span className="hero-line block">
                Your front desk <span className="block">sleeps.</span>
              </span>
            </span>
            <span className="block overflow-hidden pb-3">
              <span className="hero-line block text-brand-600">
                This one doesn&rsquo;t.
              </span>
            </span>
          </h1>

          <p className="hero-sub mt-7 max-w-2xl text-lg font-medium leading-relaxed text-ink/65 sm:text-xl">
            Nudge answers customers, books your real calendar, chases quiet
            leads and collects deposits on WhatsApp. We set up the entire
            front desk for you.
          </p>

          <div className="hero-ctas mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/waitlist" size="lg">
              Hire your Front Desk
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </ButtonLink>
            <ButtonLink href="#night-shift" variant="secondary" size="lg">
              Watch one night
              <ArrowDown className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>

        <aside className="hero-ledger relative min-w-0 max-w-[calc(100vw-2.5rem)] overflow-hidden border border-ink bg-ink p-6 text-white shadow-[8px_8px_0_#06c167] sm:max-w-none sm:p-7 lg:shadow-[18px_18px_0_#06c167]" aria-label="Live overnight shift log">
          <div className="absolute right-0 top-0 h-24 w-24 bg-brand-500" aria-hidden />
          <div className="relative flex items-start justify-between border-b border-white/20 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-300">Night shift</p>
              <p className="mt-1 text-sm text-white/55">Live activity</p>
            </div>
            <span className="relative z-10 grid h-10 w-10 place-items-center bg-white font-mono text-xs font-black text-ink">24/7</span>
          </div>
          <ol className="relative divide-y divide-white/10">
            {[
              ["12:31", "Answered a new enquiry"],
              ["02:15", "Booked Dr. Mehta · 7:30 PM"],
              ["04:40", "Recovered a quiet lead"],
              ["06:48", "Collected ₹500 deposit"],
            ].map(([time, event]) => (
              <li key={time} className="hero-ledger-row grid grid-cols-[3.5rem_1fr] gap-4 py-4">
                <span className="font-mono text-[11px] text-brand-300">{time}</span>
                <span className="text-sm font-semibold text-white/90">{event}</span>
              </li>
            ))}
          </ol>
          <div className="relative flex items-end justify-between border-t border-white/20 pt-5">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Missed overnight</p>
            <p className="font-display text-4xl font-black text-brand-300">0</p>
          </div>
        </aside>
      </div>

      {/* scroll cue */}
      <div className="hero-cue absolute bottom-7 left-1/2 z-10 -translate-x-1/2" aria-hidden>
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-ink/20 p-1.5">
          <span className="h-1.5 w-[3px] animate-bounce rounded-full bg-brand-600" />
        </div>
      </div>
    </section>
  );
}
