// src/components/marketing/v2/world/textures.ts
import * as THREE from "three";

/** Soft white radial glow — tint per-use via material.color. */
export function makeRadialTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.45, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** A calendar appointment slot: crisp white card with a time label, or the
 *  green "booked" version with a check. Drawn at 2× for sharpness. */
export function makeSlotTexture(
  label: string,
  booked = false,
  scale = 2.5
): THREE.CanvasTexture {
  const w = 240;
  const h = 176;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 26);
  ctx.fillStyle = booked ? "#06c167" : "#ffffff";
  ctx.fill();
  ctx.lineWidth = booked ? 3 : 5;
  ctx.strokeStyle = booked ? "rgba(255,255,255,0.5)" : "rgba(10,15,13,0.42)";
  ctx.stroke();
  ctx.fillStyle = booked ? "#ffffff" : "#0a0f0d";
  ctx.font = "600 44px -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(label + (booked ? " ✓" : ""), 26, 34);
  // the "detail line" under the time — filled in when booked
  ctx.beginPath();
  ctx.roundRect(26, 108, booked ? w - 70 : 90, 14, 7);
  ctx.fillStyle = booked ? "rgba(255,255,255,0.55)" : "rgba(10,15,13,0.12)";
  ctx.fill();
  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  return texture;
}

export type BubbleStyle = "out" | "in" | "dim" | "caught" | "receipt";

const BUBBLE: Record<
  BubbleStyle,
  { bg: string; fg: string; border?: string }
> = {
  out: { bg: "#005c4b", fg: "#ffffff" },
  in: { bg: "#ffffff", fg: "#101815", border: "rgba(10,15,13,0.35)" },
  // A lead gone cold: pale, quiet — barely there against the white sky.
  dim: { bg: "#edf2ef", fg: "#617169", border: "rgba(10,15,13,0.25)" },
  // The same lead after the follow-up lands: lit green, clearly alive.
  caught: { bg: "#bff2d5", fg: "#043d29", border: "rgba(0,107,66,0.85)" },
  // Payment/receipt system card for the dawn "collects" thread.
  receipt: { bg: "#ffe8b8", fg: "#5f4107", border: "rgba(150,95,0,0.7)" },
};

const font = (scale: number) =>
  `${Math.round(26 * scale)}px -apple-system, 'Segoe UI', Roboto, sans-serif`;
const subFont = (scale: number) =>
  `600 ${Math.round(22 * scale)}px -apple-system, 'Segoe UI', Roboto, sans-serif`;

/** WhatsApp-style chat bubble drawn to a canvas texture. `style` accepts the
 *  legacy boolean (true = outbound) or a named style. `subline` renders a
 *  small green status line under the text (e.g. "↳ follow-up sent ✓"). */
export function makeBubbleTexture(
  text: string,
  style: boolean | BubbleStyle,
  subline?: string,
  scale = 1
): { texture: THREE.CanvasTexture; aspect: number } {
  const key: BubbleStyle =
    typeof style === "boolean" ? (style ? "out" : "in") : style;
  const pad = 28 * scale;
  const lineH = 36 * scale;
  const maxW = 460 * scale;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font(scale);

  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);

  ctx.font = subFont(scale);
  const subW = subline ? ctx.measureText(subline).width : 0;
  ctx.font = font(scale);
  const textW = Math.min(
    maxW,
    Math.max(subW, ...lines.map((l) => ctx.measureText(l).width))
  );
  c.width = Math.ceil(textW + pad * 2);
  c.height = lines.length * lineH + pad * 2 - 6 * scale + (subline ? 34 * scale : 0);

  const s = BUBBLE[key];
  ctx.beginPath();
  ctx.roundRect(2 * scale, 2 * scale, c.width - 4 * scale, c.height - 4 * scale, 20 * scale);
  ctx.fillStyle = s.bg;
  ctx.fill();
  if (s.border) {
    ctx.lineWidth = 3 * scale;
    ctx.strokeStyle = s.border;
    ctx.stroke();
  }
  ctx.font = font(scale); // canvas resize resets 2D state
  ctx.fillStyle = s.fg;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, pad, pad - 8 * scale + i * lineH));
  if (subline) {
    ctx.font = subFont(scale);
    ctx.fillStyle = "#047f48";
    ctx.fillText(subline, pad, pad - (10 - 6) * scale + lines.length * lineH);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  return { texture, aspect: c.width / c.height };
}
