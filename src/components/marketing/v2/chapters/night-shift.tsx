"use client";

import { useRef } from "react";
import { CHAPTERS } from "../progress";
import { gsap, motionAllowed, useGSAP } from "../gsap";
import { Showcase } from "./showcase";

/** DOM copy for the four night chapters. One WhatsApp number, a team of AI
 *  agents — each chapter is a different agent on shift, timed to the same
 *  story spans the phone scene uses so words and conversation stay in step. */
const AGENTS = [
  {
    time: "12:31 AM",
    name: "Sales agent",
    line: "Answers every question in seconds — your prices, your tone.",
  },
  {
    time: "2:15 AM",
    name: "Booking agent",
    line: "Checks your real calendar and locks the slot.",
  },
  {
    time: "4:40 AM",
    name: "Follow-up agent",
    line: "Chases the leads that went quiet — on its own.",
  },
  {
    time: "6:48 AM",
    name: "Payment agent",
    line: "Sends the link and collects the deposit.",
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
        <div className="ns-copy">
          <div className="ns-copy-rail">
            {AGENTS.map((a) => (
              <article key={a.time} className="ns-beat max-w-lg py-6">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-brand-700">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-brand-500"
                      aria-hidden
                    />
                    AI agent
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/35">
                    {a.time}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-[clamp(2.35rem,4.4vw,4rem)] font-black leading-[0.96] tracking-[-0.045em] text-ink">
                  {a.name}
                </h2>
                <p className="mt-4 max-w-md text-lg font-medium leading-relaxed text-ink/60">
                  {a.line}
                </p>
              </article>
            ))}
          </div>
        </div>

        <Showcase />
      </div>
    </section>
  );
}
