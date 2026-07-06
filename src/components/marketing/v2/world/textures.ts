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
  booked = false
): THREE.CanvasTexture {
  const w = 240;
  const h = 176;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 26);
  ctx.fillStyle = booked ? "#06c167" : "#f6fbf7";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = booked ? "rgba(255,255,255,0.35)" : "rgba(10,15,13,0.1)";
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
  texture.anisotropy = 4;
  return texture;
}

const BUBBLE = {
  out: { bg: "#005c4b", fg: "#ffffff" },
  in: { bg: "#1f2c34", fg: "#f1f5f3" },
};

const FONT = "26px -apple-system, 'Segoe UI', Roboto, sans-serif";

/** WhatsApp-style chat bubble drawn to a canvas texture. */
export function makeBubbleTexture(
  text: string,
  outbound: boolean
): { texture: THREE.CanvasTexture; aspect: number } {
  const pad = 28;
  const lineH = 36;
  const maxW = 460;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = FONT;

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

  const textW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)));
  c.width = Math.ceil(textW + pad * 2);
  c.height = lines.length * lineH + pad * 2 - 6;

  const s = BUBBLE[outbound ? "out" : "in"];
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 20);
  ctx.fillStyle = s.bg;
  ctx.fill();
  ctx.font = FONT; // canvas resize resets 2D state
  ctx.fillStyle = s.fg;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, pad, pad - 8 + i * lineH));

  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 4;
  return { texture, aspect: c.width / c.height };
}
