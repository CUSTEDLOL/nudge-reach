"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { LaunchDemoButton } from "@/components/marketing/launch-cta";
import { GetAccessButton } from "@/components/marketing/get-access";
import { WhatsAppGlyph } from "@/components/marketing/holo-card";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/**
 * Hero — exactly one viewport. The pixel-park loop plays behind the copy,
 * which sits top-left (reference layout): serif headline, one-line promise,
 * then the demo CTA pair. The still is the poster/fallback; the headline
 * stays server HTML (LCP).
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);
  const leafStrip = [
    { x: 24, y: 92, size: 24, rotate: -14, color: "#6d8f42" },
    { x: 72, y: 100, size: 18, rotate: 18, color: "#86a94f" },
    { x: 124, y: 90, size: 30, rotate: -22, color: "#557238" },
    { x: 176, y: 102, size: 20, rotate: 12, color: "#93b95e" },
    { x: 232, y: 94, size: 28, rotate: -18, color: "#62803f" },
    { x: 286, y: 103, size: 19, rotate: 20, color: "#7ea34d" },
    { x: 342, y: 88, size: 32, rotate: -10, color: "#5a7539" },
    { x: 408, y: 101, size: 22, rotate: 16, color: "#92b95a" },
    { x: 474, y: 95, size: 27, rotate: -16, color: "#6c8d41" },
    { x: 538, y: 103, size: 18, rotate: 24, color: "#84a850" },
    { x: 604, y: 90, size: 30, rotate: -20, color: "#5b7739" },
    { x: 670, y: 102, size: 21, rotate: 14, color: "#88ad54" },
    { x: 736, y: 94, size: 28, rotate: -12, color: "#668344" },
    { x: 800, y: 103, size: 19, rotate: 20, color: "#9bba66" },
    { x: 864, y: 91, size: 31, rotate: -16, color: "#557038" },
    { x: 928, y: 100, size: 20, rotate: 18, color: "#89ad54" },
  ];

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      // Gentle parallax drift as the hero scrolls away — no fade; the copy
      // stays solid until the frame itself leaves. No entrance animation:
      // the headline and CTAs are simply there on load.
      gsap.to(".hero-copy", {
        yPercent: -16,
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
      aria-label="Nudge: the AI Front Desk"
    >
      {/* the day scene — one page only; the still is the poster/fallback */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/finale.jpg"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-top"
      >
        <source src="/hero/finale.mp4" type="video/mp4" />
      </video>

      {/* copy — top-left of the frame, under the navbar */}
      <div className="relative flex h-full flex-col">
        <div className="hero-copy relative z-10 mx-auto w-full max-w-[110rem] px-5 pt-24 sm:px-6 sm:pt-28 lg:pt-32">
          <h1
            className="serif-display max-w-4xl text-[clamp(1.9rem,4vw,3.6rem)] leading-[1.1] tracking-[-0.015em] text-white"
            style={{
              textShadow:
                "0 2px 10px rgba(9,40,74,0.55), 0 10px 44px rgba(9,40,74,0.45)",
            }}
          >
            <span className="hero-line block pb-1">
              The #1{" "}
              <span className="wa-word">
                <WhatsAppGlyph className="wa-logo" aria-hidden />
                WhatsApp
              </span>{" "}
              Agent
            </span>
            <span className="hero-line block pb-2">
              That Handles Your Business
            </span>
          </h1>
          <div className="hero-cta mt-5 flex flex-wrap items-center gap-3">
            <LaunchDemoButton
              tone="dark"
              className="rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-ink shadow-[0_16px_40px_-14px_rgba(7,38,28,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white/90">
              Book a Demo
            </LaunchDemoButton>
            <GetAccessButton
              source="hero"
              className="group/link inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20"
            >
              Get Access
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5"
                aria-hidden
              />
            </GetAccessButton>
          </div>
        </div>

        {/* leaf fringe — replaces the hard white glow at the bottom edge */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent via-[#4f7a31]/16 to-transparent" />
          <div className="absolute inset-x-[-4%] bottom-[-2px] h-16 bg-gradient-to-b from-transparent via-[#6b8d40]/18 to-transparent blur-[1px]" />
          <svg
            viewBox="0 0 1000 120"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-16 w-full"
          >
            <defs>
              <linearGradient id="leafFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(35,62,28,0.0)" />
                <stop offset="40%" stopColor="rgba(35,62,28,0.14)" />
                <stop offset="100%" stopColor="rgba(35,62,28,0.34)" />
              </linearGradient>
            </defs>
            <path
              d="M0 78 C 60 56, 120 112, 180 78 S 300 40, 360 76 S 480 110, 540 78 S 660 40, 720 74 S 840 108, 900 78 S 960 44, 1000 76 L 1000 120 L 0 120 Z"
              fill="url(#leafFade)"
            />
            {leafStrip.map((leaf, index) => (
              <g key={`${leaf.x}-${index}`} transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rotate})`}>
                <ellipse
                  cx="0"
                  cy="0"
                  rx={leaf.size * 0.55}
                  ry={leaf.size * 0.34}
                  fill={leaf.color}
                  opacity="0.98"
                />
                <path
                  d={`M ${-leaf.size * 0.38} 0 C ${-leaf.size * 0.12} ${-leaf.size * 0.12}, ${leaf.size * 0.12} ${-leaf.size * 0.12}, ${leaf.size * 0.38} 0`}
                  fill="none"
                  stroke="rgba(28,46,18,0.35)"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r={Math.max(1.5, leaf.size * 0.06)} fill="rgba(28,46,18,0.3)" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
