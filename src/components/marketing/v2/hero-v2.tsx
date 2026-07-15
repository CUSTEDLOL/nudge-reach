"use client";

import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { gsap, motionAllowed, useGSAP } from "./gsap";
import { PixelPark, PixelSkyline, Stars } from "./night-sky";

/**
 * Hero — the night itself, one tall continuous scene. Viewport one: starfield,
 * glowing serif nameplate, the city asleep on the horizon. Scrolling on, the
 * scene keeps going — the park below the towers, a lake, a flower meadow and
 * the glass promise card — before the page hands off to the next section.
 * Everything is server-renderable DOM: the scene is procedural SVG (no image
 * request), the headline is the LCP element.
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
      tl.from(".hero-stars", { autoAlpha: 0, duration: 1.6 }, 0).from(
        ".hero-line",
        { yPercent: 112, duration: 1.15, stagger: 0.14 },
        0.15
      );

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
      className="relative overflow-hidden bg-[#0d3f2b]"
      aria-label="Nudge — the AI Front Desk"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-[100svh]">
        <Stars className="hero-stars" />
      </div>

      {/* ---- viewport one: nameplate + skyline on the horizon ---- */}
      <div className="relative flex h-[100svh] flex-col items-center justify-center">
        {/* halo behind the nameplate */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[42%] h-[42vh] w-[min(90vw,56rem)] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(111,227,168,0.18), transparent 70%)",
          }}
        />
        <div className="hero-copy relative z-10 px-5 pb-24 text-center sm:px-8">
          <h1
            className="serif-display text-balance text-[clamp(2.5rem,6.5vw,5.2rem)] leading-[1.08] tracking-[-0.015em] text-white"
            style={{
              textShadow:
                "0 0 18px rgba(211,248,224,0.5), 0 0 64px rgba(6,193,103,0.4)",
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
        {/* the sleeping city on the horizon */}
        <PixelSkyline className="absolute inset-x-0 bottom-0 h-[44svh] min-h-[240px] w-full" />
      </div>

      {/* ---- the scene continues: the park below the towers ---- */}
      <div className="relative h-[85svh] min-h-[520px]">
        <PixelPark className="absolute inset-0 h-full w-full" />

        {/* glass card — the promise, resting on the meadow */}
        <div className="absolute inset-x-0 bottom-[10%] z-10">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div className="hero-card max-w-md rounded-2xl border border-white/[0.12] bg-white/[0.08] p-7 shadow-[0_24px_60px_-20px_rgba(2,18,11,0.8)] backdrop-blur-xl">
              <h2 className="serif-display text-[1.65rem] leading-snug text-white">
                AI that runs your WhatsApp autonomously
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/70">
                Nudge is a done-for-you AI employee — it answers customers in
                seconds, books your real calendar, chases quiet leads and
                collects payments. All night, every night.
              </p>
              <p className="mt-4 text-[11.5px] font-medium tracking-wide text-white/45">
                Official WhatsApp Cloud API · Real calendar bookings · Payments
                collected
              </p>
              <a
                href="#night-shift"
                className="group/link mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
              >
                Watch one night
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 transition-transform duration-300 group-hover/link:translate-y-0.5">
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
