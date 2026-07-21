import { ArrowRight } from "lucide-react";
import { GetAccessButton } from "@/components/marketing/get-access";

/**
 * The closer — a retro-game night: dithered sky bands in the brand ink-green
 * ramp, pixel stars, a pixel moon and a blocky grass strip (same staircase
 * language as the navbar slab). Pure SVG on a 4px grid — no video, no assets.
 */

const PX = 4; // one "game pixel" in viewBox units
const COLS = 48; // 192 / PX

// Sky bands top→bottom, each boundary blended with a one-row checkerboard
// dither (classic pixel-art gradient).
const SKY_BANDS = [
  { y: 0, h: 28, color: "#050d0a" },
  { y: 32, h: 24, color: "#07261c" },
  { y: 60, h: 20, color: "#0b3d2e" },
  { y: 84, h: 16, color: "#0a643c" },
];
const DITHER_ROWS = [
  { y: 28, upper: "#050d0a", lower: "#07261c" },
  { y: 56, upper: "#07261c", lower: "#0b3d2e" },
  { y: 80, upper: "#0b3d2e", lower: "#0a643c" },
];

// Fixed star field — placed in the y 36–78 band so it survives the bottom-
// anchored slice crop on wide screens.
const STARS = [
  { x: 12, y: 40, s: 2, c: "#f6fbf7", o: 0.9 },
  { x: 30, y: 50, s: 2, c: "#d3f8e0", o: 0.6 },
  { x: 44, y: 38, s: 2, c: "#f6fbf7", o: 0.75 },
  { x: 58, y: 58, s: 2, c: "#a9f0c9", o: 0.5 },
  { x: 70, y: 44, s: 2, c: "#f6fbf7", o: 0.85 },
  { x: 84, y: 64, s: 2, c: "#d3f8e0", o: 0.45 },
  { x: 92, y: 38, s: 2, c: "#f6fbf7", o: 0.65 },
  { x: 104, y: 52, s: 2, c: "#a9f0c9", o: 0.6 },
  { x: 118, y: 42, s: 2, c: "#f6fbf7", o: 0.9 },
  { x: 128, y: 68, s: 2, c: "#d3f8e0", o: 0.5 },
  { x: 138, y: 48, s: 2, c: "#f6fbf7", o: 0.7 },
  { x: 166, y: 58, s: 2, c: "#a9f0c9", o: 0.55 },
  { x: 178, y: 44, s: 2, c: "#f6fbf7", o: 0.8 },
  { x: 22, y: 66, s: 2, c: "#d3f8e0", o: 0.4 },
  { x: 96, y: 74, s: 2, c: "#f6fbf7", o: 0.5 },
  { x: 152, y: 72, s: 2, c: "#d3f8e0", o: 0.45 },
  { x: 40, y: 76, s: 2, c: "#a9f0c9", o: 0.35 },
  { x: 6, y: 54, s: 2, c: "#f6fbf7", o: 0.4 },
];

// Pixel moon — a chunky 12×12 block with bitten corners + two craters.
const MOON = { x: 150, y: 38 };
const MOON_BODY = [
  { x: 2, y: 0, w: 8, h: 12 },
  { x: 0, y: 2, w: 12, h: 8 },
];
const MOON_CRATERS = [
  { x: 4, y: 3, s: 2 },
  { x: 7, y: 7, s: 2 },
];

// Grass strip — irregular blocky tops (same staircase spirit as the navbar
// slab), one bright accent row, darker base.
const GRASS_TOPS = [3, 9, 14, 20, 27, 33, 38, 44]; // columns with a raised block
const GRASS_BUSHES = [
  { x: 6, y: 88, w: 8, h: 8, c: "#0b3d2e" },
  { x: 34, y: 90, w: 6, h: 6, c: "#0b3d2e" },
  { x: 120, y: 88, w: 8, h: 8, c: "#0b3d2e" },
  { x: 158, y: 90, w: 10, h: 6, c: "#0b3d2e" },
];

export function FinalCtaV2() {
  return (
    <section
      id="get-access"
      className="relative overflow-hidden bg-night"
      aria-label="Get early access to Nudge"
    >
      <svg
        viewBox="0 0 192 108"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        {SKY_BANDS.map((band) => (
          <rect key={band.y} x="0" y={band.y} width="192" height={band.h} fill={band.color} />
        ))}
        {DITHER_ROWS.map((row) =>
          Array.from({ length: COLS }, (_, i) => (
            <rect
              key={`${row.y}-${i}`}
              x={i * PX}
              y={row.y}
              width={PX}
              height={PX}
              fill={i % 2 === 0 ? row.lower : row.upper}
            />
          ))
        )}
        {STARS.map((star, i) => (
          <rect
            key={`star-${i}`}
            x={star.x}
            y={star.y}
            width={star.s}
            height={star.s}
            fill={star.c}
            opacity={star.o}
          />
        ))}
        {MOON_BODY.map((r, i) => (
          <rect
            key={`moon-${i}`}
            x={MOON.x + r.x}
            y={MOON.y + r.y}
            width={r.w}
            height={r.h}
            fill="#d3f8e0"
            opacity="0.92"
          />
        ))}
        {MOON_CRATERS.map((c, i) => (
          <rect
            key={`crater-${i}`}
            x={MOON.x + c.x}
            y={MOON.y + c.y}
            width={c.s}
            height={c.s}
            fill="#a9f0c9"
          />
        ))}
        {GRASS_BUSHES.map((b, i) => (
          <rect key={`bush-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} />
        ))}
        {/* raised grass blocks, bright cap row, then the base */}
        {GRASS_TOPS.map((col) => (
          <rect key={`top-${col}`} x={col * PX} y={92} width={PX} height={PX} fill="#02a258" />
        ))}
        <rect x="0" y="96" width="192" height="4" fill="#02a258" />
        <rect x="0" y="100" width="192" height="8" fill="#047f48" />
      </svg>

      {/* soft green aura behind the ask */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-[90px]"
      />

      <div className="relative mx-auto flex min-h-[62svh] w-full max-w-[110rem] flex-col items-center justify-center px-5 py-24 text-center sm:px-6">
        <h2
          className="serif-display max-w-3xl text-[clamp(2rem,4.5vw,4rem)] leading-[1.1] tracking-[-0.015em] text-white"
          style={{ textShadow: "0 2px 12px rgba(5,13,10,0.8)" }}
        >
          Your front desk clocks in tonight.
        </h2>
        <p
          className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-white/85"
          style={{ textShadow: "0 1px 8px rgba(5,13,10,0.7)" }}
        >
          Books real appointments, chases quiet leads, collects payments — and
          we set the whole thing up for you.
        </p>
        <GetAccessButton
          source="final-cta"
          className="group/link mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[16px] font-semibold text-ink shadow-[0_16px_48px_-12px_rgba(6,193,103,0.45)] transition-all hover:-translate-y-0.5 hover:bg-brand-100"
        >
          Get Early Access
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5"
            aria-hidden
          />
        </GetAccessButton>
      </div>
    </section>
  );
}
