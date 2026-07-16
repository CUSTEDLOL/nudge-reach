"use client";

import { useRef } from "react";
import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — one tall continuous day scene: a pixel-art park where the owner
 * sits back on the grass while WhatsApp works, world landmarks across the
 * lake. Viewport one puts the serif nameplate in the sky; scrolling on, the
 * meadow continues and the glass promise card rests on the clover before
 * the page hands off to the daylight sections. The illustration is a single
 * cover image; the headline stays server HTML (it IS the LCP element).
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
      tl.from(".hero-line", { yPercent: 112, duration: 1.15, stagger: 0.14 }, 0.15);

      // The card lives below the fold, over the meadow — reveal on arrival.
      gsap.from(".hero-card", {
        autoAlpha: 0,
        y: 30,
        duration: 0.9,
        ease: "expo.out",
        scrollTrigger: { trigger: ".hero-card", start: "top 88%" },
      });

      // Gentle drift as the nameplate scrolls away — depth without distraction.
      gsap.to(".hero-copy", {
        yPercent: -16,
        autoAlpha: 0.15,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "50% top",
          scrub: true,
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#7fb2e8]"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* the day scene — spans both hero viewports, sky up top, clover below */}
      <Image
        src="/hero/park-day.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-top"
      />

      {/* ---- viewport one: nameplate in the sky ---- */}
      <div className="relative flex h-[100svh] flex-col items-center justify-center">
        <div className="hero-copy relative z-10 px-5 pb-32 text-center sm:px-8">
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
      </div>

      {/* ---- the scene continues down the meadow ---- */}
      <div className="relative h-[85svh] min-h-[520px]">
        {/* glass card — the promise, resting on the clover */}
        <div className="absolute inset-x-0 bottom-[10%] z-10">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div className="hero-card max-w-md rounded-2xl border border-white/60 bg-white/75 p-7 shadow-[0_24px_60px_-24px_rgba(7,38,28,0.45)] backdrop-blur-xl">
              <h2 className="serif-display text-[1.65rem] leading-snug text-ink">
                AI that runs your WhatsApp autonomously
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink/70">
                Nudge is a done-for-you AI employee — it answers customers in
                seconds, books your real calendar, chases quiet leads and
                collects payments. All night, every night.
              </p>
              <p className="mt-4 text-[11.5px] font-medium tracking-wide text-ink/50">
                Official WhatsApp Cloud API · Real calendar bookings · Payments
                collected
              </p>
              <a
                href="#night-shift"
                className="group/link mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink"
              >
                Watch one night
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ink/10 transition-transform duration-300 group-hover/link:translate-y-0.5">
                  <ArrowDown className="h-3 w-3" aria-hidden />
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* hand-off into the daylight page below */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white/90"
        />
      </div>
    </section>
  );
}
