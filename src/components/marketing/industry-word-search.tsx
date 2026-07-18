"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Container, Section } from "./section";

/**
 * Industries as a word-search, wearing the bento theme (ink border, hard
 * offset shadow, gradient fill, backdrop word). The grid starts fully blank
 * and hovering (or focusing/tapping) a word draws its bar in and leaves it
 * highlighted for good. The grid is a real 16-column CSS grid that fills the
 * card edge to edge, so every box positions in plain percentages.
 *
 * The gate: until all seven are found, scrolling past the section is held —
 * the page eases back and a prompt appears. It always lets go (all found,
 * a few determined scrolls, or keyboard/reduced-motion), so nobody is
 * trapped.
 */

const COLS = 16;
const COL_PCT = 100 / COLS;

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
  { label: "Real estate", row: 1, col: 2, len: 10, color: "rgba(250,204,21,0.85)" },
  { label: "Clinics", row: 3, col: 3, len: 7, color: "rgba(52,211,153,0.85)" },
  { label: "Cafes", row: 4, col: 3, len: 5, color: "rgba(251,146,60,0.85)" },
  { label: "Hotels", row: 5, col: 2, len: 6, color: "rgba(56,189,248,0.85)" },
  { label: "Schools", row: 6, col: 4, len: 7, color: "rgba(244,114,182,0.85)" },
  { label: "Colleges", row: 7, col: 1, len: 8, color: "rgba(167,139,250,0.9)" },
  { label: "Salons", row: 8, col: 4, len: 6, color: "rgba(45,212,191,0.85)" },
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Determined scrolls before the gate lets go regardless. */
const GATE_PATIENCE = 26;

/** The shared box every word occupies — the bar and the hit target both use
 * it, so they always line up exactly. Columns are percentages of the grid;
 * rows use the row-height var. */
function wordBox(w: (typeof WORDS)[number]): CSSProperties {
  return {
    top: `calc(${w.row} * var(--cellh) + var(--cellh) * 0.14)`,
    left: `calc(${w.col * COL_PCT}% + 2px)`,
    width: `calc(${w.len * COL_PCT}% - 4px)`,
    height: "calc(var(--cellh) * 0.72)",
  };
}

export function IndustryWordSearch() {
  // Once found, a word never un-highlights.
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());
  const [held, setHeld] = useState(false);
  const [released, setReleased] = useState(false);
  const allFound = found.size === WORDS.length;

  function reveal(i: number) {
    setFound((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  // The gate. Clamps downward scroll at the section's bottom edge until the
  // grid is solved. Runs through Lenis when it's driving, native otherwise.
  useEffect(() => {
    if (allFound || released) return;
    const el = document.getElementById("industries");
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let attempts = 0;
    let ticking = false;
    let hideTimer = 0;

    const clamp = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const past = window.innerHeight - rect.bottom;
      // Only bite once the section has been read: its bottom is leaving.
      // The correcting scroll fires this again with past ≈ 0 — leave `held`
      // alone there, or the prompt would blink out the instant it appears.
      if (past <= 0) return;
      const limit = Math.max(0, window.scrollY - past);
      const lenis = window.__lenis;
      if (lenis) lenis.scrollTo(limit, { immediate: true });
      else window.scrollTo(0, limit);
      setHeld(true);
      // Keep the prompt up while they keep pushing; hide it 1.6s after the
      // last time the gate actually bit.
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setHeld(false), 1600);
      attempts += 1;
      if (attempts > GATE_PATIENCE) setReleased(true);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(clamp);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(hideTimer);
    };
  }, [allFound, released]);

  return (
    <Section id="industries" className="bg-white">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            Built for your business.
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <article
            className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-4 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-6"
            style={{
              background:
                "linear-gradient(135deg, #e4f8ee 0%, #eefadd 52%, #fdf7e6 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute -bottom-5 -right-2 select-none whitespace-nowrap font-display text-[clamp(4.5rem,10vw,9rem)] font-black uppercase leading-none tracking-[-0.08em] text-white/45"
            >
              Fits
            </div>
            <div
              aria-hidden
              className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[38px] border-white/25"
            />

            <p className="sr-only">
              Nudge works for real estate, clinics, cafes, hotels, schools,
              colleges and salons. Hover each word to mark it found.
            </p>

            <div
              className="relative isolate z-10 w-full cursor-crosshair select-none font-mono"
              style={{ "--cellh": "min(9.2vw, 3.6rem)" } as CSSProperties}
            >
              {/* marker fills — behind the letters, blank until found. */}
              {WORDS.map((w, i) => (
                <span
                  key={w.label}
                  aria-hidden
                  className="absolute rounded-[0.35em]"
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

              {/* letters — a real grid, so the board fills the card. */}
              {ROWS.map((row, r) => (
                <div
                  key={r}
                  className="relative z-10 grid"
                  style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
                >
                  {row.split("").map((ch, c) => (
                    <span
                      key={c}
                      className="grid h-[var(--cellh)] place-items-center text-[calc(var(--cellh)*0.46)] font-bold tracking-tight text-ink"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              ))}

              {/* hover / focus / tap targets — transparent, above the letters
                  so the whole word is one hit area. */}
              {WORDS.map((w, i) => (
                <div
                  key={w.label}
                  role="button"
                  tabIndex={0}
                  aria-label={`Reveal ${w.label}`}
                  aria-pressed={found.has(i)}
                  className="absolute z-20 cursor-pointer rounded-[0.35em] outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                  style={wordBox(w)}
                  onMouseEnter={() => reveal(i)}
                  onFocus={() => reveal(i)}
                  onClick={() => reveal(i)}
                />
              ))}
            </div>
          </article>
        </div>
      </Container>

      {/* The gate's prompt. Absolute, not fixed: DaySection puts a GSAP
          transform on an ancestor, which would make `fixed` resolve against
          that box instead of the viewport. The gate clamps exactly when the
          section's bottom meets the viewport bottom, so this lands just above
          the fold anyway. */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-8 z-40 flex justify-center px-4"
        style={{
          opacity: held ? 1 : 0,
          transform: held ? "translateY(0)" : "translateY(12px)",
          transition: `opacity 260ms ${EASE}, transform 260ms ${EASE}`,
        }}
      >
        <span className="rounded-full border-2 border-ink/70 bg-white px-5 py-2.5 text-center text-[12.5px] font-black uppercase tracking-[0.08em] text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)]">
          {found.size === 0
            ? "Find your industry first"
            : `${WORDS.length - found.size} to go`}
        </span>
      </div>
    </Section>
  );
}
