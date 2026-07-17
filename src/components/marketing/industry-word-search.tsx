"use client";

import { motion } from "motion/react";
import { type CSSProperties } from "react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";

/**
 * Industries as a word-search: a monospace letter grid where the verticals
 * we serve get circled one by one as the section scrolls into view. Filler
 * rows hide legible texture words (WHATSAPP, SPAS, GYMS…) that stay
 * uncircled. Layout is driven by two CSS vars (--cell / --cellh) so the
 * rings can be positioned with pure calc() — no measuring.
 */
// prettier-ignore
const ROWS = [
  "QWEWHATSAPPKTIAZ",
  "ARREALESTATEVCXQ",
  "YSPASTVIBEGYMSKJ",
  "WERCLINICSIDETYM",
  "AINCAFESTERFIRMB",
  "GBHOTELSTINGFIRK",
  "HCONSCHOOLSERPOI",
  "JCOLLEGESULTINGQ",
  "KSTRSALONSGENTVX",
  "LRUYADGROWTHENCY",
];

/** The circled finds — row, start column, length. */
const WORDS: { label: string; row: number; col: number; len: number }[] = [
  { label: "Real estate", row: 1, col: 2, len: 10 },
  { label: "Clinics", row: 3, col: 3, len: 7 },
  { label: "Cafes", row: 4, col: 3, len: 5 },
  { label: "Hotels", row: 5, col: 2, len: 6 },
  { label: "Schools", row: 6, col: 4, len: 7 },
  { label: "Colleges", row: 7, col: 1, len: 8 },
  { label: "Salons", row: 8, col: 4, len: 6 },
];

const CIRCLED = new Set(
  WORDS.flatMap((w) =>
    Array.from({ length: w.len }, (_, i) => `${w.row}:${w.col + i}`)
  )
);

export function IndustryWordSearch() {
  const reduce = useReducedMotionSafe();

  return (
    <Section id="industries" className="bg-[#faf9f5]">
      <Container>
        <SectionHeading
          eyebrow="Works across industries"
          title="Find your business."
          subtitle="Site visits for real estate, appointments for clinics, tables for cafes, rooms for hotels, admissions for schools and colleges — one Front Desk, trained for the counter it runs."
        />

        <Reveal delay={0.1} className="mt-14 sm:mt-16">
          {/* the sr story; the visual grid below is decorative */}
          <p className="sr-only">
            Nudge works for real estate, clinics, cafes, hotels, schools,
            colleges and salons.
          </p>
          <div
            aria-hidden
            className="relative mx-auto w-fit select-none font-mono"
            style={
              {
                "--cell": "clamp(1.15rem, 5.2vw, 3.1rem)",
                "--cellh": "clamp(1.7rem, 7vw, 4rem)",
              } as CSSProperties
            }
          >
            {ROWS.map((row, r) => (
              <div key={r} className="flex">
                {row.split("").map((ch, c) => (
                  <span
                    key={c}
                    className={`grid h-[var(--cellh)] w-[var(--cell)] place-items-center text-[calc(var(--cell)*0.62)] font-semibold tracking-tight ${
                      CIRCLED.has(`${r}:${c}`) ? "text-ink" : "text-ink/30"
                    }`}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            ))}

            {/* the finds — circled one by one as the grid enters */}
            {WORDS.map((w, i) => {
              const style: CSSProperties = {
                top: `calc(${w.row} * var(--cellh) + var(--cellh) * 0.08)`,
                left: `calc(${w.col} * var(--cell) - var(--cell) * 0.28)`,
                width: `calc(${w.len} * var(--cell) + var(--cell) * 0.56)`,
                height: "calc(var(--cellh) * 0.84)",
              };
              return reduce ? (
                <span
                  key={w.label}
                  className="absolute rounded-full border-2 border-brand-500/80"
                  style={style}
                />
              ) : (
                <motion.span
                  key={w.label}
                  className="absolute rounded-full border-2 border-brand-500/80 shadow-[0_0_0_4px_rgba(6,193,103,0.08)]"
                  style={style}
                  initial={{ opacity: 0, scale: 0.72 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-18% 0px -18% 0px" }}
                  transition={{
                    delay: 0.35 + i * 0.28,
                    duration: 0.45,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                />
              );
            })}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
