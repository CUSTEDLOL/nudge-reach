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
        .from(".hero-ledger", { autoAlpha: 0, y: 24, duration: 0.9 }, 0.48)
        .from(".hero-ledger-row", { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.12 }, 0.75)
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

      <div className="hero-copy relative z-10 mx-auto grid w-full max-w-[100vw] grid-cols-[minmax(0,1fr)] items-center gap-12 overflow-hidden px-5 pb-16 pt-28 sm:px-8 lg:max-w-7xl lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)] lg:gap-16 lg:overflow-visible">
        <div className="min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-none">
          <p className="hero-eyebrow flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            On shift now · 11:47 PM
          </p>

          <h1 className="mt-7 font-display text-[clamp(2.35rem,5.8vw,5.4rem)] font-black leading-[0.93] tracking-[-0.05em] text-ink">
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
            Nudge answers customers, <strong className="font-bold text-ink/90">books your real calendar</strong>,
            chases quiet leads and <strong className="font-bold text-ink/90">collects deposits</strong> on
            WhatsApp. <strong className="font-bold text-ink/90">We set up the entire front desk for you.</strong>
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

        <aside
          className="hero-ledger relative min-w-0 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-lift sm:max-w-none"
          aria-label="A real overnight WhatsApp conversation handled by Nudge"
        >
          {/* chat header */}
          <div className="flex items-center gap-3 border-b border-ink/8 bg-[#f7faf8] px-5 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-black text-white">
              S
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-ink">
                Sunrise Dental Clinic
              </p>
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Nudge is on shift
              </p>
            </div>
            <span className="ml-auto font-mono text-[10.5px] font-bold text-ink/35">
              12:31 AM
            </span>
          </div>

          {/* thread */}
          <div className="flex flex-col gap-2.5 px-4 py-5 sm:px-5">
            <div className="hero-ledger-row max-w-[85%] self-start rounded-2xl rounded-tl-md bg-[#eef3f0] px-3.5 py-2.5 text-[13.5px] leading-snug text-ink">
              Hi — do you have anything tomorrow evening? Tooth&rsquo;s been
              hurting since Sunday
              <span className="mt-1 block text-right font-mono text-[9.5px] text-ink/35">
                12:31 AM
              </span>
            </div>
            <div className="hero-ledger-row max-w-[85%] self-end rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2.5 text-[13.5px] leading-snug text-white">
              <strong>7:30 PM with Dr. Mehta</strong> is open tomorrow. Shall I
              book it for you?
              <span className="mt-1 block text-right font-mono text-[9.5px] text-white/55">
                12:31 AM
              </span>
            </div>
            <div className="hero-ledger-row max-w-[85%] self-start rounded-2xl rounded-tl-md bg-[#eef3f0] px-3.5 py-2.5 text-[13.5px] leading-snug text-ink">
              yes please 🙏
              <span className="mt-1 block text-right font-mono text-[9.5px] text-ink/35">
                12:32 AM
              </span>
            </div>
            <div className="hero-ledger-row max-w-[85%] self-end rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2.5 text-[13.5px] leading-snug text-white">
              Done — <strong>booked for 7:30 PM tomorrow</strong>. Here&rsquo;s
              the ₹500 deposit link to hold it.
              <span className="mt-1 block text-right font-mono text-[9.5px] text-white/55">
                12:32 AM
              </span>
            </div>
            <div className="hero-ledger-row self-center rounded-full border border-amber-500/40 bg-amber-50 px-3.5 py-1.5 font-mono text-[11px] font-bold text-amber-800">
              ₹500 received · UPI · 12:34 AM ✓
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-ink/8 bg-[#f7faf8] px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
              While you slept
            </p>
            <p className="text-[12.5px] font-black text-brand-700">
              Booked + paid, <span className="font-mono">0</span> missed
            </p>
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
