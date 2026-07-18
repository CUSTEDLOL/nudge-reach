"use client";

import { useState, type CSSProperties } from "react";
import { MousePointerClick } from "lucide-react";
import { Container, Section } from "./section";

/**
 * Industries as a word-search, wearing the bento theme (ink border, hard
 * offset shadow, gradient fill, backdrop word). The grid starts fully blank —
 * no marker colour anywhere — and hovering (or focusing/tapping) a word draws
 * its bar in and leaves it highlighted for good; words already found stay
 * found regardless of where the cursor goes next. Every word reads left→right
 * so it scans instantly. Every letter shares the exact same
 * font/weight/colour — the coloured bar is the only thing that marks a find.
 * Filler rows hide legible texture words (WHATSAPP, SPAS, GYMS…) that never
 * highlight. Layout is two CSS vars (--cell / --cellh) so every box positions
 * with pure calc() — no measuring.
 */

// Every row is exactly 16 columns.
// prettier-ignore
const ROWS = [
  "QWEWHATSAPPKTIAZ",
  "ARREALESTATEVHXQ",
  "YSPASTVIBEGYMSKJ",
  "SERCLINICSIDETYM",
  "AINCAFESTERFIEMB",
  "LGHOTELSTINGFIRK",
  "OCONSCHOOLSERSOI",
  "NCOLLEGESULTINGQ",
  "SSTRSALONSGENTVX",
  "LRUYADGROWTHENCY",
];

/** The findable words — row, start column, length, marker colour. All
 * horizontal, so the box maths stays a single case. */
const WORDS: {
  label: string;
  row: number;
  col: number;
  len: number;
  color: string;
}[] = [
  { label: "Real estate", row: 1, col: 2, len: 10, color: "rgba(250,204,21,0.85)" }, // yellow
  { label: "Clinics", row: 3, col: 3, len: 7, color: "rgba(52,211,153,0.85)" }, // green
  { label: "Cafes", row: 4, col: 3, len: 5, color: "rgba(251,146,60,0.85)" }, // orange
  { label: "Hotels", row: 5, col: 2, len: 6, color: "rgba(56,189,248,0.85)" }, // sky
  { label: "Schools", row: 6, col: 4, len: 7, color: "rgba(244,114,182,0.85)" }, // pink
  { label: "Colleges", row: 7, col: 1, len: 8, color: "rgba(167,139,250,0.9)" }, // violet
  { label: "Salons", row: 8, col: 4, len: 6, color: "rgba(45,212,191,0.85)" }, // teal
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** The shared box every word occupies — the bar and the hover hit target both
 * use this, so they always line up exactly. */
function wordBox(w: (typeof WORDS)[number]): CSSProperties {
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
  const allFound = found.size === WORDS.length;

  function reveal(i: number) {
    setFound((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  return (
    <Section id="industries" className="bg-white">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            Built for your business.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            Site visits for real estate, appointments for clinics, tables for
            cafes, rooms for hotels, admissions for schools and colleges: one
            Front Desk, trained for the counter it runs.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <article
            className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-8"
            style={{
              background:
                "linear-gradient(135deg, #a9f0c9 0%, #d8f5a6 52%, #fdefb4 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute -bottom-5 -right-2 select-none whitespace-nowrap font-display text-[clamp(4.5rem,10vw,9rem)] font-black uppercase leading-none tracking-[-0.08em] text-white/25"
            >
              Fits
            </div>
            <div
              aria-hidden
              className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[38px] border-white/15"
            />

            {/* the affordance — tells people the grid is playable, then
                doubles as a progress counter once they start finding */}
            <div className="relative z-10 flex justify-center">
              <span
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink/70 bg-white/85 px-4 py-1.5 text-center text-[11.5px] font-black uppercase tracking-[0.08em] text-ink sm:text-[12.5px]"
              >
                <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {found.size === 0
                  ? "Hover the grid to find your industry"
                  : allFound
                    ? "All 7 found: that's your desk"
                    : `${found.size} of ${WORDS.length} found`}
              </span>
            </div>

            <p className="sr-only">
              Nudge works for real estate, clinics, cafes, hotels, schools,
              colleges and salons.
            </p>

            <div className="relative z-10 mt-7 flex justify-center overflow-x-auto">
              <div
                className="relative isolate w-fit cursor-crosshair select-none font-mono"
                style={
                  {
                    "--cell": "clamp(1.05rem, 4.6vw, 2.6rem)",
                    "--cellh": "clamp(1.55rem, 6vw, 3.3rem)",
                  } as CSSProperties
                }
              >
                {/* marker fills — behind the letters, blank until found. */}
                {WORDS.map((w, i) => (
                  <span
                    key={w.label}
                    aria-hidden
                    className="absolute rounded-[0.4em]"
                    style={{
                      ...wordBox(w),
                      backgroundColor: w.color,
                      transformOrigin: "left center",
                      transform: found.has(i) ? "scaleX(1)" : "scaleX(0)",
                      opacity: found.has(i) ? 1 : 0,
                      transition: `transform 650ms ${EASE}, opacity 300ms ${EASE}`,
                    }}
                  />
                ))}

                {/* letters — on top of the marker layer. Every letter is
                    styled identically; only the bar behind it marks a find. */}
                {ROWS.map((row, r) => (
                  <div key={r} className="relative z-10 flex">
                    {row.split("").map((ch, c) => (
                      <span
                        key={c}
                        className="grid h-[var(--cellh)] w-[var(--cell)] place-items-center text-[calc(var(--cell)*0.62)] font-bold tracking-tight text-ink"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                ))}

                {/* hover / focus / tap targets — transparent, above the
                    letters so the whole word is one hit area regardless of
                    which cell the cursor lands on. */}
                {WORDS.map((w, i) => (
                  <div
                    key={w.label}
                    role="button"
                    tabIndex={0}
                    aria-label={`Reveal ${w.label}`}
                    aria-pressed={found.has(i)}
                    className="absolute z-20 cursor-crosshair rounded-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
                    style={wordBox(w)}
                    onMouseEnter={() => reveal(i)}
                    onFocus={() => reveal(i)}
                    onClick={() => reveal(i)}
                  />
                ))}
              </div>
            </div>
          </article>
        </div>
      </Container>
    </Section>
  );
}
