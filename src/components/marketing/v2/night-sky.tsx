import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Procedural pixel-art night: a seeded starfield, a three-rank city skyline
 * and a park (canopy → lake → flower meadow) that continues the scene below
 * the first viewport. Deterministic (LCG, fixed seeds) so server and client
 * always render the identical scene — no runtime randomness, no image asset
 * to ship or 404. Everything is merged into a handful of <path>s so the DOM
 * stays tiny.
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const snap = (v: number, g = 2) => Math.round(v / g) * g;
const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h${-w}z`;

/* ------------------------------------------------------------------ *
 * Skyline — floor at y=200 on a 480-wide stage.
 * ------------------------------------------------------------------ */

type RowOpts = {
  seed: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  litP: number;
  crownP: number;
  /** Chance a building is a fully-lit landmark tower. */
  landmarkP?: number;
  windows?: boolean;
};

function buildRow({
  seed,
  minW,
  maxW,
  minH,
  maxH,
  litP,
  crownP,
  landmarkP = 0,
  windows = true,
}: RowOpts) {
  const rnd = lcg(seed);
  let bodies = "";
  let edges = "";
  let winsDark = "";
  let winsLit = "";
  let x = -8;
  while (x < 486) {
    const landmark = rnd() < landmarkP;
    const w = snap(minW + rnd() * (maxW - minW), 4);
    const h = snap(
      landmark ? maxH + 24 + rnd() * 24 : minH + rnd() * (maxH - minH),
      4
    );
    const top = 200 - h;
    bodies += rect(x, top, w, h);
    // moonlit left-edge strip — cheap volume
    edges += rect(x, top, 2, h);

    if (landmark || rnd() < crownP) {
      // stepped art-deco crown
      const s1 = snap(w * 0.62, 4);
      const s2 = snap(w * 0.34, 4);
      bodies += rect(x + snap((w - s1) / 2), top - 6, s1, 6);
      bodies += rect(x + snap((w - s2) / 2), top - 12, s2, 6);
      if (landmark || rnd() < 0.5)
        bodies += rect(x + snap(w / 2), top - 24, 2, 12);
    } else if (rnd() < 0.25) {
      bodies += rect(x + snap(w / 2) - 1, top - 14, 2, 14);
    }

    if (windows) {
      const p = landmark ? 0.55 : litP;
      for (let wx = x + 4; wx <= x + w - 8; wx += 8) {
        for (let wy = top + 6; wy <= 188; wy += 10) {
          const roll = rnd();
          if (roll < p) winsLit += rect(wx, wy, 4, 4);
          else if (roll < 0.6) winsDark += rect(wx, wy, 4, 4);
        }
      }
    }

    x += w + snap(2 + rnd() * 10, 2);
  }
  return { bodies, edges, winsDark, winsLit };
}

const FAR = buildRow({
  seed: 5,
  minW: 20,
  maxW: 44,
  minH: 44,
  maxH: 96,
  litP: 0,
  crownP: 0.25,
  windows: false,
});
const BACK = buildRow({
  seed: 11,
  minW: 24,
  maxW: 52,
  minH: 72,
  maxH: 156,
  litP: 0.08,
  crownP: 0.35,
  landmarkP: 0.06,
});
const FRONT = buildRow({
  seed: 23,
  minW: 28,
  maxW: 60,
  minH: 32,
  maxH: 112,
  litP: 0.13,
  crownP: 0.45,
  landmarkP: 0.08,
});

/** Blocky tree clumps hugging the skyline floor. */
function buildTreeline(seed: number) {
  const rnd = lcg(seed);
  let d = "";
  let x = -6;
  while (x < 486) {
    const w = snap(10 + rnd() * 18, 2);
    const h = snap(8 + rnd() * 16, 2);
    const h1 = Math.max(2, snap(h * 0.55, 2));
    const w2 = Math.max(4, snap(w * 0.6, 2));
    d += rect(x, 200 - h1, w, h1);
    d += rect(x + snap((w - w2) / 2), 200 - h, w2, h - h1);
    x += w - snap(rnd() * 6, 2);
  }
  return d;
}

const TREELINE = buildTreeline(31);

export function PixelSkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 200"
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("block", className)}
    >
      {/* far haze rank */}
      <path d={FAR.bodies} fill="#2f8557" />
      {/* mid rank */}
      <path d={BACK.bodies} fill="#1d5f41" />
      <path d={BACK.edges} fill="#2b7a52" />
      <path d={BACK.winsDark} fill="#174e35" />
      <path d={BACK.winsLit} fill="#d8b46a" opacity={0.9} />
      {/* near rank */}
      <path d={FRONT.bodies} fill="#0a3a26" />
      <path d={FRONT.edges} fill="#155338" />
      <path d={FRONT.winsDark} fill="#06281a" />
      <path d={FRONT.winsLit} fill="#ffd98a" />
      {/* park treetops peeking over the floor */}
      <path d={TREELINE} fill="#06301e" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * The park — canopy, lake, flower meadow, two people watching the city.
 * Stage: 480 × 300, top edge continues the skyline floor.
 * ------------------------------------------------------------------ */

function treeBlob(x: number, yTop: number, w: number, h: number) {
  const h1 = Math.max(2, snap(h * 0.55, 2));
  const h2 = Math.max(2, snap(h * 0.3, 2));
  const w2 = Math.max(4, snap(w * 0.72, 2));
  const w3 = Math.max(4, snap(w * 0.42, 2));
  return (
    rect(x, yTop, w, h1) +
    rect(x + snap((w - w2) / 2), yTop + h1, w2, h2) +
    rect(x + snap((w - w3) / 2), yTop + h1 + h2, w3, Math.max(2, h - h1 - h2))
  );
}

function buildPark() {
  const rnd = lcg(97);
  let canopyBack = "";
  let canopyFront = "";
  let tips = "";
  let ripples = "";
  let rippleHi = "";
  let glint = "";
  let speckDark = "";
  let speckLight = "";
  let flowersWarm = "";
  let flowersCool = "";
  let frame = "";

  // back canopy band hanging from the horizon — kept low so the water shows
  let x = -10;
  while (x < 486) {
    const w = snap(18 + rnd() * 28, 2);
    const h = snap(16 + rnd() * 22, 2);
    canopyBack += treeBlob(x, 0, w, h);
    if (rnd() < 0.6) tips += rect(x + snap(rnd() * (w - 4), 2), snap(rnd() * 8, 2), 2, 2);
    x += w - snap(rnd() * 10, 2);
  }
  // brighter front clumps
  x = -8;
  while (x < 486) {
    const w = snap(14 + rnd() * 22, 2);
    const h = snap(12 + rnd() * 18, 2);
    if (rnd() < 0.68) {
      canopyFront += treeBlob(x, snap(6 + rnd() * 10, 2), w, h);
      if (rnd() < 0.7) tips += rect(x + snap(rnd() * (w - 4), 2), snap(8 + rnd() * 12, 2), 2, 2);
    }
    x += w + snap(rnd() * 8, 2);
  }

  // open water (band y ~46..118)
  for (let i = 0; i < 72; i++) {
    const rx = snap(rnd() * 468, 2);
    const ry = snap(48 + rnd() * 62, 2);
    const rw = snap(4 + rnd() * 10, 2);
    if (rnd() < 0.3) rippleHi += rect(rx, ry, rw, 2);
    else ripples += rect(rx, ry, rw, 2);
  }
  // moonlight glint column on the water
  for (let i = 0; i < 11; i++) {
    glint += rect(snap(292 + (rnd() - 0.5) * 28, 2), 50 + i * 6, snap(4 + rnd() * 6, 2), 2);
  }

  // meadow texture (y 118..300)
  for (let gx = 0; gx < 480; gx += 6) {
    for (let gy = 122; gy < 300; gy += 6) {
      const roll = rnd();
      if (roll < 0.22) speckDark += rect(gx, gy, 2, 2);
      else if (roll < 0.4) speckLight += rect(gx, gy, 2, 2);
    }
  }
  // flowers — denser toward the bottom
  for (let gx = 0; gx < 480; gx += 10) {
    for (let gy = 130; gy < 300; gy += 10) {
      const density = 0.04 + ((gy - 130) / 170) * 0.14;
      const roll = rnd();
      if (roll < density * 0.45) flowersWarm += rect(gx + snap(rnd() * 6, 2), gy, 2, 2);
      else if (roll < density) flowersCool += rect(gx + snap(rnd() * 6, 2), gy, 2, 2);
    }
  }

  // big framing trees at the edges
  frame += treeBlob(-18, 0, 56, 150) + treeBlob(24, 16, 40, 110);
  frame += treeBlob(442, 0, 56, 160) + treeBlob(418, 20, 42, 116);

  return {
    canopyBack,
    canopyFront,
    tips,
    ripples,
    rippleHi,
    glint,
    speckDark,
    speckLight,
    flowersWarm,
    flowersCool,
    frame,
  };
}

const PARK = buildPark();

/** Two tiny silhouettes, sitting together in the grass by the water. */
const FIGURES =
  // left person: head, body, legs folded
  rect(228, 156, 4, 4) +
  rect(226, 160, 8, 8) +
  rect(224, 166, 12, 2) +
  // right person, a touch taller
  rect(242, 154, 4, 4) +
  rect(240, 158, 8, 10) +
  rect(238, 166, 12, 2);

export function PixelPark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 300"
      preserveAspectRatio="xMidYMin slice"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("block", className)}
    >
      {/* ground base: lake band then meadow */}
      <rect x="0" y="0" width="480" height="118" fill="#1e5f9e" />
      <rect x="0" y="118" width="480" height="182" fill="#215c33" />
      {/* shore highlight */}
      <rect x="0" y="118" width="480" height="3" fill="#37804a" />
      {/* water */}
      <path d={PARK.ripples} fill="#3d85c4" />
      <path d={PARK.rippleHi} fill="#5ba3d9" />
      <path d={PARK.glint} fill="#9ccbf0" />
      {/* meadow texture + flowers */}
      <path d={PARK.speckDark} fill="#164426" />
      <path d={PARK.speckLight} fill="#37804a" />
      <path d={PARK.flowersWarm} fill="#ffd98a" />
      <path d={PARK.flowersCool} fill="#dfe6ff" />
      {/* trees ringing the lake */}
      <path d={PARK.canopyBack} fill="#123f24" />
      <path d={PARK.canopyFront} fill="#1d5c34" />
      <path d={PARK.tips} fill="#46955c" />
      {/* the two of them, off duty */}
      <path d={FIGURES} fill="#041a10" />
      {/* framing foreground trees */}
      <path d={PARK.frame} fill="#0a2e1a" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Starfield.
 * ------------------------------------------------------------------ */

type Star = {
  left: number;
  top: number;
  s: number;
  o: number;
  dur: number;
  delay: number;
  bright: boolean;
};

const STARS: Star[] = (() => {
  const rnd = lcg(7);
  return Array.from({ length: 130 }, () => ({
    left: rnd() * 100,
    top: rnd() * 62,
    s: rnd() < 0.14 ? 2.5 : 1.5,
    o: 0.3 + rnd() * 0.55,
    dur: 2.2 + rnd() * 4,
    delay: rnd() * 5,
    bright: rnd() < 0.08,
  }));
})();

export function Stars({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {STARS.map((st, i) => (
        <span
          key={i}
          className="absolute animate-pulse rounded-full bg-white motion-reduce:animate-none"
          style={
            {
              left: `${st.left}%`,
              top: `${st.top}%`,
              width: st.s,
              height: st.s,
              opacity: st.o,
              animationDuration: `${st.dur}s`,
              animationDelay: `${st.delay}s`,
              boxShadow: st.bright
                ? "0 0 6px 1.5px rgba(255,255,255,0.75)"
                : undefined,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
