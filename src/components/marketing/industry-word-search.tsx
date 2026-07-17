import { type CSSProperties } from "react";
import { Container, Section, SectionHeading } from "./section";

/**
 * Industries as a word-search: a monospace letter grid where the verticals
 * we serve are highlighted — each in its own marker colour — by a stroke
 * that draws in on its turn and then STAYS, building up top→bottom (row
 * order) until the whole grid is highlighted, then resets together and
 * chases again from the first word (pure CSS, so it runs all the time
 * regardless of scroll). Two entries (Hotels, Salons) run DOWN a column
 * instead of across a row, so it reads as a real crossword rather than a
 * flat word search. Every letter shares the exact same font/weight/colour —
 * the coloured bar is the only thing that marks a found word, never bold
 * text. Filler rows/columns hide legible texture words (WHATSAPP, SPAS,
 * GYMS…) that stay un-highlighted. Layout is two CSS vars (--cell / --cellh)
 * so the bars position with pure calc() — no measuring.
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

/** The highlighted finds — row, start column, length, marker colour, and
 * orientation (default horizontal). Hotels runs down column 13 (rows 1-6);
 * Salons runs down column 0 (rows 3-8) — both through filler cells, so the
 * five horizontal words are unaffected. Order = reveal order (top→bottom by
 * each word's own top-most row), and its index drives which hl-chase-N(v)
 * keyframe it uses. */
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

function markerStyle(w: (typeof WORDS)[number], i: number): CSSProperties {
  const vertical = w.orientation === "vertical";
  const animationName = `hl-chase-${i}${vertical ? "v" : ""}`;
  if (vertical) {
    return {
      top: `calc(${w.row} * var(--cellh) - var(--cellh) * 0.22)`,
      left: `calc(${w.col} * var(--cell) + var(--cell) * 0.13)`,
      width: "calc(var(--cell) * 0.74)",
      height: `calc(${w.len} * var(--cellh) + var(--cellh) * 0.44)`,
      backgroundColor: w.color,
      transformOrigin: "center top",
      animationName,
    };
  }
  return {
    top: `calc(${w.row} * var(--cellh) + var(--cellh) * 0.13)`,
    left: `calc(${w.col} * var(--cell) - var(--cell) * 0.22)`,
    width: `calc(${w.len} * var(--cell) + var(--cell) * 0.44)`,
    height: "calc(var(--cellh) * 0.74)",
    backgroundColor: w.color,
    animationName,
  };
}

export function IndustryWordSearch() {
  return (
    <Section id="industries" className="bg-[#faf9f5]">
      <Container>
        <SectionHeading
          eyebrow="Works across industries"
          title="Find your business."
          subtitle="Site visits for real estate, appointments for clinics, tables for cafes, rooms for hotels, admissions for schools and colleges — one Front Desk, trained for the counter it runs."
        />

        <div className="mt-14 sm:mt-16">
          <p className="sr-only">
            Nudge works for real estate, clinics, cafes, hotels, schools,
            colleges and salons.
          </p>
          <div
            aria-hidden
            className="relative isolate mx-auto w-fit select-none font-mono"
            style={
              {
                "--cell": "clamp(1.15rem, 5.2vw, 3.1rem)",
                "--cellh": "clamp(1.7rem, 7vw, 4rem)",
              } as CSSProperties
            }
          >
            {/* marker fills — behind the letters. Each bar draws in on its
                own turn and stays; horizontal bars sweep left→right, the two
                vertical ones sweep top→bottom. */}
            {WORDS.map((w, i) => (
              <span
                key={w.label}
                className="hl-bar absolute rounded-[0.4em]"
                style={markerStyle(w, i)}
              />
            ))}

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
          </div>
        </div>
      </Container>
    </Section>
  );
}
