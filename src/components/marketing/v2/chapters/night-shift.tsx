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
      const rail = ref.current?.querySelector<HTMLElement>(".ns-copy-rail");
      const spans = Object.values(CHAPTERS);

      gsap.set(beats, {
        yPercent: -50,
        y: (i) => i * 320,
        autoAlpha: (i) => (i === 0 ? 1 : 0.1),
      });
      if (rail) gsap.set(rail, { y: 0 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
        },
      });
      tl.to({}, { duration: 1 });

      beats.forEach((beat, i) => {
        const c = spans[i];
        const enter = i === 0 ? c.start : c.start + 0.015;
        const exit = Math.max(enter, c.end - 0.07);

        if (rail) {
          tl.to(
            rail,
            { y: -i * 320, duration: 0.075, ease: "power2.inOut" },
            enter
          );
        }

        tl.to(
          beat,
          { autoAlpha: 1, duration: 0.055, ease: "power2.out" },
          enter
        ).to(
          beat,
          { autoAlpha: 0.1, duration: 0.06, ease: "power2.in" },
          exit
        );

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
        {/* Desktop masks leave one clean window into the persistent WebGL
            world. The animation remains the same; it now reads as product UI. */}
        <div className="ns-world-mask ns-mask-left" aria-hidden />
        <div className="ns-world-mask ns-mask-top" aria-hidden />
        <div className="ns-world-mask ns-mask-right" aria-hidden />
        <div className="ns-world-mask ns-mask-bottom" aria-hidden />

        <div className="ns-copy">
          <div className="ns-copy-rail">
            {BEATS.map((b) => (
              <article key={b.time} className="ns-beat max-w-lg py-6">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 bg-brand-500" aria-hidden />
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">
                  {b.time}
                </p>
              </div>
              <h2 className="mt-4 font-display text-[clamp(2.35rem,4.4vw,4rem)] font-black leading-[0.96] tracking-[-0.045em] text-ink">
                {b.title}
              </h2>
              <p className="mt-5 max-w-md text-lg font-medium leading-relaxed text-ink/65">
                {b.body}
              </p>
              </article>
            ))}
          </div>
        </div>

        <div className="ns-browser" aria-hidden>
          <div className="ns-browser-viewport">
            <div className="ns-browser-grid" />
          </div>
        </div>
      </div>
    </section>
  );
}
