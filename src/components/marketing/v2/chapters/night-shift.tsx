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
    route: "inbox / live conversation",
    status: "Replying in your voice",
  },
  {
    time: "2:15 AM",
    title: "It books.",
    body: "Not 'we open at 10.' It checks your real calendar, locks the slot, and sends the confirmation — booked while you sleep.",
    route: "calendar / availability",
    status: "Checking real slots",
  },
  {
    time: "4:40 AM",
    title: "It chases.",
    body: "The lead that went quiet on Tuesday gets a follow-up worth answering. Meta's free AI can't start that conversation. Yours can.",
    route: "follow-ups / revenue recovery",
    status: "Recovering quiet leads",
  },
  {
    time: "6:48 AM",
    title: "It collects.",
    body: "Payment link sent, deposit in, reminder scheduled. The night's work is already revenue before you're awake.",
    route: "payments / deposits",
    status: "Logging confirmed payment",
  },
];

export function NightShift() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const beats = gsap.utils.toArray<HTMLElement>(".ns-beat");
      const addresses = gsap.utils.toArray<HTMLElement>(".ns-browser-address");
      const statuses = gsap.utils.toArray<HTMLElement>(".ns-browser-status");
      const screens = [...addresses, ...statuses];
      const progress = ref.current?.querySelector<HTMLElement>(".ns-browser-progress");
      const spans = Object.values(CHAPTERS);

      gsap.set(beats, {
        yPercent: -50,
        y: (i) => i * 190,
        autoAlpha: (i) => (i === 0 ? 1 : 0.1),
      });
      gsap.set(screens, {
        y: (i) => (i === 0 ? 0 : 12),
        autoAlpha: (i) => (i === 0 ? 1 : 0),
      });
      if (progress) gsap.set(progress, { scaleX: 0, transformOrigin: "left" });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
        },
      });
      tl.to({}, { duration: 1 });

      if (progress) {
        tl.to(progress, { scaleX: 1, ease: "none", duration: 1 }, 0);
      }

      beats.forEach((beat, i) => {
        const c = spans[i];
        const enter = i === 0 ? c.start : c.start + 0.015;
        const exit = Math.max(enter, c.end - 0.07);

        tl.to(
          beat,
          { autoAlpha: 1, y: 0, duration: 0.065, ease: "power2.out" },
          enter
        ).to(
          beat,
          { autoAlpha: 0.1, y: -190, duration: 0.07, ease: "power2.in" },
          exit
        );

        [addresses[i], statuses[i]].forEach((screen) => {
          if (!screen) return;
          tl.to(
            screen,
            { autoAlpha: 1, y: 0, duration: 0.05, ease: "power2.out" },
            enter
          ).to(
            screen,
            { autoAlpha: 0, y: -10, duration: 0.045, ease: "power2.in" },
            c.end - 0.05
          );
        });
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

        <div className="ns-browser" aria-hidden>
          <div className="ns-browser-chrome">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-inner">
              {BEATS.map((b, i) => (
                <div key={b.route} className="ns-browser-address absolute inset-0 flex items-center justify-center px-4">
                  <span className="truncate font-mono text-[11px] text-ink/45">
                    nudge.ai / {b.route}
                  </span>
                  <span className="absolute right-3 font-mono text-[10px] font-bold text-brand-700">
                    {String(i + 1).padStart(2, "0")} / 04
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ns-browser-viewport">
            <div className="ns-browser-grid" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
              <div className="relative h-7 flex-1 overflow-hidden">
                {BEATS.map((b) => (
                  <div key={b.status} className="ns-browser-status absolute inset-0 flex items-center">
                    <span className="border border-ink/10 bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-ink/60 shadow-sm backdrop-blur">
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
              <span className="bg-ink px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-brand-300">
                Live
              </span>
            </div>
          </div>

          <div className="ns-browser-progress absolute inset-x-0 bottom-0 h-1 bg-brand-500" />
        </div>
      </div>
    </section>
  );
}
