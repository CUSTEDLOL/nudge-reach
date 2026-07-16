"use client";

import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — exactly one viewport. The pixel-park loop plays behind the serif
 * nameplate; the glass promise card rests at the bottom of the same frame.
 * The still is the poster/fallback; the headline stays server HTML (LCP).
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      // Hold the intro while the brand splash is wiping off stage.
      const splash = document.getElementById("nudge-splash");
      const tl = gsap.timeline({
        delay: splash ? 3.25 : 0,
        defaults: { ease: "expo.out" },
      });
      tl.from(".hero-line", { yPercent: 112, duration: 1.15, stagger: 0.14 }, 0.15).from(
        ".hero-card",
        { autoAlpha: 0, y: 24, duration: 0.9 },
        0.8
      );

      // Gentle drift as the hero scrolls away — depth without distraction.
      gsap.to(".hero-copy", {
        yPercent: -16,
        autoAlpha: 0.15,
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
      className="relative h-[100svh] overflow-hidden bg-[#7fb2e8]"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* the day scene — one page only; the still is the poster/fallback */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/park-day.jpg"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-top"
      >
        <source src="/hero/park-day.mp4" type="video/mp4" />
      </video>

      {/* nameplate */}
      <div className="relative flex h-full flex-col items-center justify-center">
        <div className="hero-copy relative z-10 px-5 pb-28 text-center sm:px-8 sm:pb-24">
          <h1
            className="serif-display text-balance text-[clamp(2.1rem,6.5vw,5.2rem)] leading-[1.08] tracking-[-0.015em] text-white"
            style={{
              textShadow:
                "0 2px 10px rgba(9,40,74,0.55), 0 10px 44px rgba(9,40,74,0.45)",
            }}
          >
            <span className="block overflow-hidden pb-1">
              <span className="hero-line block">The AI Front Desk</span>
            </span>
            <span className="block overflow-hidden pb-2">
              <span className="hero-line block">For Your WhatsApp</span>
            </span>
          </h1>
        </div>

        {/* glass promise card — inside the same viewport */}
        <div className="absolute inset-x-5 bottom-6 z-10 sm:inset-x-8 sm:bottom-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="hero-card max-w-md rounded-2xl border border-white/50 bg-white/70 p-5 shadow-[0_24px_60px_-24px_rgba(7,38,28,0.45)] backdrop-blur-xl sm:p-6">
              <h2 className="serif-display text-[1.25rem] leading-snug text-ink sm:text-[1.45rem]">
                AI that runs your WhatsApp autonomously
              </h2>
              <p className="mt-2 hidden text-[13.5px] leading-relaxed text-ink/70 sm:block">
                A done-for-you AI employee — it answers customers in seconds,
                books your real calendar, chases quiet leads and collects
                payments. All night, every night.
              </p>
              <a
                href="#night-shift"
                className="group/link mt-3 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink sm:mt-4"
              >
                Watch one night
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ink/10 transition-transform duration-300 group-hover/link:translate-y-0.5">
                  <ArrowDown className="h-3 w-3" aria-hidden />
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* hand-off into the page below */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white/80"
        />
      </div>
    </section>
  );
}
