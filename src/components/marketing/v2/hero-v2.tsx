"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ButtonLink } from "../button";
import { Magnetic } from "../motion-primitives";
import { gsap, useGSAP, motionAllowed } from "./gsap";

const Nightfield = dynamic(() => import("./nightfield"), { ssr: false });

/**
 * Hero — 11:47 PM. The headline is server HTML (it IS the LCP element); the
 * nightfield canvas, ambient video and intro choreography are all layered on
 * top after the fact and never gate first paint. The 3D chunk loads on idle,
 * desktop-only, and stops rendering the moment the hero leaves the viewport.
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mount3d, setMount3d] = useState(false);
  const [active3d, setActive3d] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const [allowMedia, setAllowMedia] = useState(false);

  // Lazy-mount the WebGL sky: motion allowed + desktop + browser idle.
  useEffect(() => {
    if (!motionAllowed()) return;
    setAllowMedia(true);
    if (!matchMedia("(min-width: 1024px)").matches) return;
    const idle =
      "requestIdleCallback" in window
        ? (cb: () => void) => (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 2500 })
        : (cb: () => void) => setTimeout(cb, 350);
    idle(() => setMount3d(true));
  }, []);

  // Pause the frameloop (and the ambient video) when the hero is offscreen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive3d(entry.isIntersecting),
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-eyebrow", { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
        .from(
          ".hero-line",
          { yPercent: 112, duration: 1.1, stagger: 0.12 },
          0.15
        )
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
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-night"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* layer 0: aurora mesh (always present — the designed fallback) */}
      <div className="bg-mesh absolute inset-0 opacity-60" aria-hidden />

      {/* layer 1: ambient video A1 (optional asset; hides itself on 404) */}
      {allowMedia && videoOk && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-[0.22]"
          autoPlay={active3d}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/landing/a1-poster.jpg"
          onError={() => setVideoOk(false)}
          aria-hidden
        >
          <source src="/landing/a1-hero-loop.webm" type="video/webm" />
          <source src="/landing/a1-hero-loop.mp4" type="video/mp4" />
        </video>
      )}

      {/* layer 2: the WebGL nightfield (lazy, desktop, idle) */}
      {mount3d && (
        <div className="absolute inset-0" aria-hidden>
          <Nightfield active={active3d} />
        </div>
      )}

      {/* layer 3: vignette so type always sits on solid night */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(5,13,10,0.85) 100%)",
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

        <h1 className="mt-7 font-display text-[clamp(3.1rem,9vw,7.25rem)] leading-[0.96] tracking-tight text-white">
          <span className="block overflow-hidden pb-1">
            <span className="hero-line block">Your best employee</span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="hero-line block italic text-brand-300">
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
          <Magnetic>
            <ButtonLink href="/waitlist" size="lg">
              Hire your Front Desk
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </ButtonLink>
          </Magnetic>
          <ButtonLink href="#night-shift" variant="secondary-dark" size="lg">
            See it work
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
