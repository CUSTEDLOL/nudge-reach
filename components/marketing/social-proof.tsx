"use client";

import { Container } from "./section";
import { CountUp, Marquee, Reveal } from "./motion-primitives";

const STATS = [
  { to: 12400, prefix: "", suffix: "+", label: "Messages delivered in simulation", decimals: 0 },
  { to: 98, suffix: "%", label: "Average delivery rate", decimals: 0 },
  { to: 3.2, suffix: "×", label: "Faster first response", decimals: 1 },
  { to: 0.7, prefix: "₹", label: "Avg. cost per message", decimals: 1 },
];

const CATEGORIES = [
  "Apparel & textiles",
  "Jewellery",
  "Home décor",
  "Bakery & food",
  "D2C brands",
  "Salons & spas",
  "Clinics",
  "Electronics",
  "Footwear",
  "Gifting",
];

export function SocialProof() {
  return (
    <section className="relative border-y border-black/5 bg-white py-14">
      <Container>
        <Reveal className="text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink/40">
            The conversation layer for modern retail & D2C teams
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-7">
          <Marquee speed={32} gap="0.85rem" className="py-1">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className="rounded-full border border-black/5 bg-brand-50/60 px-4 py-2 text-sm font-semibold text-brand-800"
              >
                {c}
              </span>
            ))}
          </Marquee>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-black/5 bg-black/5 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.08}
              className="bg-white p-6 text-center sm:p-7"
            >
              <p className="text-4xl font-semibold tracking-tight text-ink sm:text-[2.6rem]">
                <CountUp
                  to={s.to}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals}
                />
              </p>
              <p className="mt-2 text-[13.5px] font-medium leading-snug text-ink/55">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
