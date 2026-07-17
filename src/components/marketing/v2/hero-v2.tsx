"use client";

import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — exactly one viewport. The pixel-park loop plays behind the copy,
 * which sits top-left (reference layout): serif headline, one-line promise,
 * then the demo CTA pair. The still is the poster/fallback; the headline
 * stays server HTML (LCP).
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
        [".hero-sub", ".hero-cta"],
        { autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.12 },
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
        poster="/hero/park-cta-v2.jpg"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-top"
      >
        <source src="/hero/park-cta-v2.mp4" type="video/mp4" />
      </video>

      {/* copy — top-left of the frame, under the navbar */}
      <div className="relative flex h-full flex-col">
        <div className="hero-copy relative z-10 mx-auto w-full max-w-[110rem] px-5 pt-32 sm:px-6 sm:pt-36 lg:pt-40">
          <h1
            className="serif-display max-w-4xl text-[clamp(2.2rem,5vw,4.6rem)] leading-[1.08] tracking-[-0.015em] text-white"
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
          <p
            className="hero-sub mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/95 sm:text-[17px]"
            style={{ textShadow: "0 2px 12px rgba(9,40,74,0.6)" }}
          >
            A done-for-you AI employee — it answers customers in seconds,
            books your real calendar, chases quiet leads and collects
            payments. All night, every night.
          </p>
          <div className="hero-cta mt-7 flex flex-wrap items-center gap-3">
            <BookDemoButton className="rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-ink shadow-[0_16px_40px_-14px_rgba(7,38,28,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white/90">
              Book a Demo
            </BookDemoButton>
            <a
              href="#night-shift"
              className="group/link inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20"
            >
              Watch one night
              <ArrowDown
                className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-y-0.5"
                aria-hidden
              />
            </a>
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
