"use client";

import { useState, type CSSProperties } from "react";
import { Container, Section, SectionHeading } from "./section";

/**
 * Industries as a word-search: a monospace letter grid where the verticals
 * we serve are hidden until found. The grid starts fully blank — no marker
 * colour anywhere — and hovering (or focusing/tapping) a word draws its bar
 * in and leaves it highlighted for good; words already found stay found
 * regardless of where the cursor goes next. Two entries (Hotels, Salons)
 * run DOWN a column instead of across a row, so it reads as a real
 * crossword rather than a flat word search. Every letter shares the exact
 * same font/weight/colour — the coloured bar is the only thing that marks a
 * find, never bold text. Filler rows/columns hide legible texture words
 * (WHATSAPP, SPAS, GYMS…) that never highlight. Layout is two CSS vars
 * (--cell / --cellh) so every box positions with pure calc() — no measuring.
 */

// prettier-ignore
const ROWS = [
  "QWEWHATSAPPKTIAZ",
  "ARREALESTATEVHXQ",
  "YSPASTVIBEGYMOKJ",
  "SERCLINICSIDETYM",
  "AINCAFESTERFIEMB",
  "LGBTINGFIRKDVLMN",
  "OCONSCHOOLSERSOI",
  "NCOLLEGESULTINGQ",
  "SSTRSALONSGENTVX",
  "LRUYADGROWTHENCY",
];

/** The findable words — row, start column, length, marker colour, and
 * orientation (default horizontal). Hotels runs down column 13 (rows 1-6);
 * Salons runs down column 0 (rows 3-8) — both through filler cells, so the
 * five horizontal words are unaffected. */
const WORDS: {
  label: string;
  row: number;
  col: number;
  len: number;
  color: string;
  orientation?: "horizontal" | "vertical";
}[] = [
  { label: "Real estate", row: 1, col: 2, len: 10, color: "rgba(250,204,21,0.55)" }, // yellow
  { label: "Hotels", row: 1, col: 13, len: 6, color: "rgba(56,189,248,0.55)", orientation: "vertical" }, // sky
  { label: "Clinics", row: 3, col: 3, len: 7, color: "rgba(52,211,153,0.55)" }, // green
  { label: "Salons", row: 3, col: 0, len: 6, color: "rgba(45,212,191,0.55)", orientation: "vertical" }, // teal
  { label: "Cafes", row: 4, col: 3, len: 5, color: "rgba(251,146,60,0.55)" }, // orange
  { label: "Schools", row: 6, col: 4, len: 7, color: "rgba(244,114,182,0.55)" }, // pink
  { label: "Colleges", row: 7, col: 1, len: 8, color: "rgba(167,139,250,0.6)" }, // violet
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** The shared box every word occupies — bar, and hover/focus hit target,
 * both use this so they always line up exactly. */
function wordBox(w: (typeof WORDS)[number]): CSSProperties {
  const vertical = w.orientation === "vertical";
  if (vertical) {
    return {
      top: `calc(${w.row} * var(--cellh) - var(--cellh) * 0.22)`,
      left: `calc(${w.col} * var(--cell) + var(--cell) * 0.13)`,
      width: "calc(var(--cell) * 0.74)",
      height: `calc(${w.len} * var(--cellh) + var(--cellh) * 0.44)`,
    };
  }
  return {
    top: `calc(${w.row} * var(--cellh) + var(--cellh) * 0.13)`,
    left: `calc(${w.col} * var(--cell) - var(--cell) * 0.22)`,
    width: `calc(${w.len} * var(--cell) + var(--cell) * 0.44)`,
    height: "calc(var(--cellh) * 0.74)",
  };
}

export function IndustryWordSearch() {
  // Once found, a word never un-highlights — hovering elsewhere doesn't
  // clear it, and re-hovering it is a harmless no-op.
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());

  function reveal(i: number) {
    setFound((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  return (
    <Section id="industries" className="bg-[#faf9f5]">
      <Container>
        <SectionHeading
          eyebrow="Works across industries"
          title="Find your business."
          subtitle="Site visits for real estate, appointments for clinics, tables for cafes, rooms for hotels, admissions for schools and colleges — one Front Desk, trained for the counter it runs. Hover a word to find it."
        />

        <div className="mt-14 sm:mt-16">
          <p className="sr-only">
            Nudge works for real estate, clinics, cafes, hotels, schools,
            colleges and salons.
          </p>
          <div
            className="relative isolate mx-auto w-fit select-none font-mono"
            style={
              {
                "--cell": "clamp(1.15rem, 5.2vw, 3.1rem)",
                "--cellh": "clamp(1.7rem, 7vw, 4rem)",
              } as CSSProperties
            }
          >
            {/* marker fills — behind the letters, blank until found. */}
            {WORDS.map((w, i) => {
              const vertical = w.orientation === "vertical";
              const isFound = found.has(i);
              return (
                <span
                  key={w.label}
                  aria-hidden
                  className="absolute rounded-[0.4em]"
                  style={{
                    ...wordBox(w),
                    backgroundColor: w.color,
                    transformOrigin: vertical ? "center top" : "left center",
                    transform: isFound
                      ? vertical
                        ? "scaleY(1)"
                        : "scaleX(1)"
                      : vertical
                        ? "scaleY(0)"
                        : "scaleX(0)",
                    opacity: isFound ? 1 : 0,
                    transition: `transform 650ms ${EASE}, opacity 300ms ${EASE}`,
                  }}
                />
              );
            })}

            {/* letters — on top of the marker layer. Every letter is styled
                identically; only the marker bar behind it marks a find. */}
            {ROWS.map((row, r) => (
              <div key={r} className="relative z-10 flex">
                {row.split("").map((ch, c) => (
                  <span
                    key={c}
                    className="grid h-[var(--cellh)] w-[var(--cell)] place-items-center text-[calc(var(--cell)*0.62)] font-semibold tracking-tight text-ink"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            ))}

            {/* hover / focus / tap targets — transparent, sit above the
                letters so the whole word is one hit area regardless of
                which cell the cursor lands on. */}
            {WORDS.map((w, i) => (
              <div
                key={w.label}
                role="button"
                tabIndex={0}
                aria-label={`Reveal ${w.label}`}
                aria-pressed={found.has(i)}
                className="absolute z-20 cursor-pointer rounded-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                style={wordBox(w)}
                onMouseEnter={() => reveal(i)}
                onFocus={() => reveal(i)}
                onClick={() => reveal(i)}
              />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
