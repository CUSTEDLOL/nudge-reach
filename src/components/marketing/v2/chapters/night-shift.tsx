"use client";

import { useRef } from "react";
import { CHAPTERS } from "../progress";
import { gsap, motionAllowed, useGSAP } from "../gsap";

/** DOM copy for the four night chapters, timed to the same story spans the
 *  3D scenes use, so words and world stay in lockstep. */
const BEATS = [
  {
    time: "12:31 AM",
    title: "It answers.",
    body: "A customer writes at half past midnight. The Front Desk replies in seconds — your services, your prices, your tone. No 'we'll get back to you.'",
  },
  {
    time: "2:15 AM",
    title: "It books.",
    body: "Not 'we open at 10.' It checks your real calendar, locks the slot, and sends the confirmation — booked while you sleep.",
  },
  {
    time: "4:40 AM",
    title: "It chases.",
    body: "The lead that went quiet on Tuesday gets a follow-up worth answering. Meta's free AI can't start that conversation. Yours can.",
  },
  {
    time: "6:48 AM",
    title: "It collects.",
    body: "Payment link sent, deposit in, reminder scheduled. The night's work is already revenue before you're awake.",
  },
];

export function NightShift() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const beats = gsap.utils.toArray<HTMLElement>(".ns-beat");
      gsap.set(beats, { yPercent: -50 });
      const spans = Object.values(CHAPTERS);
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
        },
      });
      beats.forEach((beat, i) => {
        const c = spans[i];
        tl.fromTo(
          beat,
          { autoAlpha: 0, y: 60 },
          { autoAlpha: 1, y: 0, duration: 0.1 },
          c.start + 0.03
        ).to(beat, { autoAlpha: 0, y: -50, duration: 0.08 }, c.end - 0.06);
      });
    },
    { scope: ref }
  );

  return (
    <section
      id="night-shift"
      ref={ref}
      className="ns-track relative"
      aria-label="What the Front Desk does overnight"
    >
      <div className="ns-stage">
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          {BEATS.map((b) => (
            <article key={b.time} className="ns-beat max-w-xl py-16 lg:py-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-200/80">
                {b.time}
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] text-white">
                {b.title}
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
                {b.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
