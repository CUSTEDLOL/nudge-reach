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
        .from(".hero-chips", { autoAlpha: 0, duration: 0.9 }, 0.85)
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
      {/* aurora mesh — the designed fallback when the world can't render */}
      <div className="bg-mesh absolute inset-0 opacity-40" aria-hidden />

      {/* vignette so type always sits on solid night */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(5,13,10,0.7) 100%)",
        }}
      />

      {/* copy */}
      <div className="hero-copy relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-32 sm:px-8">
        <p className="hero-eyebrow flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-200/80">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
          </span>
          11:47 PM — your shop closed five hours ago
        </p>

        <h1 className="mt-7 font-display text-[clamp(2.9rem,8vw,6.5rem)] font-bold leading-[0.98] tracking-[-0.03em] text-white">
          <span className="block overflow-hidden pb-1">
            <span className="hero-line block">Your best employee</span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="hero-line block text-brand-300">
              doesn&rsquo;t sleep.
            </span>
          </span>
        </h1>

        <p className="hero-sub mt-7 max-w-xl text-lg leading-relaxed text-white/60">
          Nudge&rsquo;s AI Front Desk answers, books, and follows up on
          WhatsApp — set up for you, for a third of a salary. It works the
          hours you can&rsquo;t.
        </p>

        <div className="hero-ctas mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/waitlist" size="lg">
            Hire your Front Desk
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
          </ButtonLink>
          <ButtonLink href="#night-shift" variant="secondary-dark" size="lg">
            Watch the night shift
            <ArrowDown className="h-4 w-4" />
          </ButtonLink>
        </div>

        <ul className="hero-chips mt-12 flex flex-wrap gap-x-8 gap-y-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          <li>Books real appointments</li>
          <li>Chases quiet leads</li>
          <li>Set up for you</li>
        </ul>
      </div>

      {/* scroll cue */}
      <div className="hero-cue absolute bottom-7 left-1/2 z-10 -translate-x-1/2" aria-hidden>
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-white/15 p-1.5">
          <span className="h-1.5 w-[3px] animate-bounce rounded-full bg-brand-300" />
        </div>
      </div>
    </section>
  );
}
