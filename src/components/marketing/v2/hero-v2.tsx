"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";
import { ButtonLink } from "../button";
import { gsap, motionAllowed, useGSAP } from "./gsap";

const TRUST = [
  { icon: ShieldCheck, label: "Official WhatsApp Cloud API" },
  { icon: CalendarCheck, label: "Books your real calendar" },
  { icon: IndianRupee, label: "Collects payments" },
];

/**
 * Hero — photo-first, in the site's own light world. A full-bleed stylized
 * illustration of an owner at ease carries the promise; the headline is
 * server HTML (it IS the LCP element) set against the image's airy left
 * half. Without the image the soft mint-morning gradient is the look.
 */
export function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null);
  // The mint gradient IS the look until the image ships (or if it 404s).
  const [photoOk, setPhotoOk] = useState(true);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-eyebrow", { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
        .from(".hero-line", { yPercent: 112, duration: 1.1, stagger: 0.12 }, 0.15)
        .from(".hero-sub", { autoAlpha: 0, y: 18, duration: 0.8 }, 0.55)
        .from(".hero-ctas", { autoAlpha: 0, y: 16, duration: 0.8 }, 0.7)
        .from(".hero-trust", { autoAlpha: 0, y: 12, duration: 0.8 }, 0.85)
        .from(".hero-ledger", { autoAlpha: 0, y: 24, duration: 0.9 }, 0.6)
        .from(".hero-ledger-row", { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.12 }, 0.8)
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
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-white"
      aria-label="Nudge — the AI Front Desk"
    >
      {/* Soft mint-morning base: the designed look until/behind the photo. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(90% 90% at 74% 35%, #e3f3ea 0%, #f4faf7 52%, #ffffff 100%)",
        }}
      />
      {photoOk && (
        <Image
          src="/hero/front-desk.jpg"
          alt="A business owner relaxed after closing time while her WhatsApp keeps working"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[68%_center]"
          onError={() => setPhotoOk(false)}
        />
      )}
      {/* Legibility grade: airy white left third for type, quiet top/bottom. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.68) 34%, rgba(255,255,255,0.10) 62%, rgba(255,255,255,0.22) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white/85 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white/70 to-transparent"
        aria-hidden
      />

      <div className="hero-copy relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center px-5 pb-24 pt-32 sm:px-8">
        <div className="max-w-3xl">
          <p className="hero-eyebrow flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            On shift now · 11:47 PM
          </p>

          <h1 className="mt-7 font-display text-[clamp(2.6rem,6vw,5.6rem)] font-black leading-[0.95] tracking-[-0.045em] text-ink">
            <span className="block overflow-hidden pb-1">
              <span className="hero-line block">Your front desk sleeps.</span>
            </span>
            <span className="block overflow-hidden pb-3">
              <span className="hero-line block text-brand-600">
                This one doesn&rsquo;t.
              </span>
            </span>
          </h1>

          <p className="hero-sub mt-6 max-w-xl text-lg font-medium leading-relaxed text-ink/65 sm:text-xl">
            Nudge answers customers,{" "}
            <strong className="font-bold text-ink/90">books your real calendar</strong>,
            chases quiet leads and{" "}
            <strong className="font-bold text-ink/90">collects deposits</strong>{" "}
            on WhatsApp — set up entirely for you.
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

          <ul className="hero-trust mt-12 flex flex-wrap items-center gap-x-7 gap-y-2.5">
            {TRUST.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-[13px] font-semibold text-ink/55"
              >
                <Icon className="h-4 w-4 text-brand-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* the night's receipt — a quiet chat toast riding the photo */}
      <aside
        className="hero-ledger absolute bottom-16 right-8 z-10 hidden w-[19.5rem] overflow-hidden rounded-2xl border border-black/[0.07] bg-white/85 shadow-lift backdrop-blur-xl md:block xl:right-14"
        aria-label="A real overnight WhatsApp conversation handled by Nudge"
      >
        <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-[11.5px] font-black text-white">
            S
          </span>
          <p className="truncate text-[12.5px] font-bold text-ink">
            Sunrise Dental Clinic
          </p>
          <span className="ml-auto font-mono text-[9.5px] font-bold text-ink/35">
            12:32 AM
          </span>
        </div>
        <div className="flex flex-col gap-2 px-3.5 py-4">
          <div className="hero-ledger-row max-w-[88%] self-start rounded-xl rounded-tl-sm bg-[#eef3f0] px-3 py-2 text-[12.5px] leading-snug text-ink">
            Anything tomorrow evening? Tooth&rsquo;s been hurting since Sunday
          </div>
          <div className="hero-ledger-row max-w-[88%] self-end rounded-xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[12.5px] leading-snug text-white">
            Booked — <strong>7:30 PM with Dr. Mehta</strong>. Deposit link sent
            to hold it.
          </div>
          <div className="hero-ledger-row self-center rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1 font-mono text-[10.5px] font-bold text-amber-800">
            ₹500 received · UPI ✓
          </div>
        </div>
      </aside>

      {/* scroll cue */}
      <div className="hero-cue absolute bottom-7 left-1/2 z-10 -translate-x-1/2" aria-hidden>
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-ink/20 p-1.5">
          <span className="h-1.5 w-[3px] animate-bounce rounded-full bg-brand-600" />
        </div>
      </div>
    </section>
  );
}
