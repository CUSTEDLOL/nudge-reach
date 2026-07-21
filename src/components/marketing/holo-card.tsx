"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CalendarCheck } from "lucide-react";
import { LaunchDemoButton } from "./launch-cta";
import { useReducedMotionSafe } from "./motion-primitives";

/**
 * The footer's collectible: a LEGENDARY trading card of the AI Front Desk.
 * Hover (or drag a finger) and the card tilts in 3D while a rainbow foil +
 * glare track the pointer — the classic holo-card effect, no libraries.
 * The artwork window is the pixel park the whole site lives in; the moves
 * read like attacks. Reduced motion ⇒ the card sits still (foil stays off).
 */

/** Official WhatsApp glyph (simple-icons path, CC0). Shared with the hero's
 * glowing "WhatsApp" word. */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

const MOVES = [
  {
    name: "Answers instantly",
    desc: "Replies to every customer — 3 AM included.",
    power: "24/7",
  },
  {
    name: "Books appointments",
    desc: "Checks your real calendar, locks the slot.",
    power: "AUTO",
  },
  {
    name: "Collects payments",
    desc: "Sends the deposit link. No more no-shows.",
    power: "PAID",
  },
];

export function HoloCard() {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || reduce) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0 → 1
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--px", String(px));
    el.style.setProperty("--py", String(py));
  }

  function onLeave() {
    const el = ref.current;
    setHovering(false);
    if (!el) return;
    el.style.setProperty("--px", "0.5");
    el.style.setProperty("--py", "0.5");
  }

  return (
    <div
      className="mx-auto w-full max-w-[23rem]"
      style={{ perspective: "1100px" }}
    >
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerEnter={() => !reduce && setHovering(true)}
        onPointerLeave={onLeave}
        className="group relative select-none"
        style={
          {
            "--px": 0.5,
            "--py": 0.5,
            transform: hovering
              ? "rotateY(calc((var(--px) - 0.5) * 22deg)) rotateX(calc((var(--py) - 0.5) * -18deg)) scale(1.03)"
              : "rotateY(0deg) rotateX(0deg) scale(1)",
            transformStyle: "preserve-3d",
            transition: hovering
              ? "transform 120ms ease-out"
              : "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
          } as CSSProperties
        }
      >
        {/* card body — legendary gold-foil rim around an ink slab */}
        <article className="relative overflow-hidden rounded-[1.4rem] border-2 border-ink/80 bg-[linear-gradient(160deg,#f7e08b_0%,#e8b64c_18%,#f9ecb0_38%,#d9a53c_60%,#f7e08b_82%,#e3af45_100%)] p-[9px] shadow-[12px_14px_0_rgba(10,15,13,0.82)] transition-shadow duration-300 group-hover:shadow-[16px_20px_0_rgba(10,15,13,0.82)]">
          <div className="relative overflow-hidden rounded-[1rem] bg-[#0c1f16] p-3.5">
            {/* pixel corner accents — the minecraft wink */}
            <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-8 w-8 opacity-60 [background:conic-gradient(from_90deg_at_6px_6px,#ffd94a_25%,transparent_0)_0_0/12px_12px_no-repeat,conic-gradient(from_90deg_at_3px_3px,#ffd94a_25%,transparent_0)_12px_12px/6px_6px_no-repeat]" />
            <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 rotate-180 opacity-60 [background:conic-gradient(from_90deg_at_6px_6px,#ffd94a_25%,transparent_0)_0_0/12px_12px_no-repeat,conic-gradient(from_90deg_at_3px_3px,#ffd94a_25%,transparent_0)_12px_12px/6px_6px_no-repeat]" />

            {/* name bar */}
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border-2 border-[#ffd94a]/70 bg-[#06c167] text-white shadow-[0_0_14px_rgba(6,193,103,0.55)]">
                  <WhatsAppGlyph className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-display text-[17px] font-black uppercase leading-none tracking-[-0.02em] text-white">
                    AI Front Desk
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#ffd94a]/90">
                    ★ Runs your WhatsApp for you
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-white/50">
                  HP
                </p>
                <p className="font-display text-[19px] font-black leading-none text-white">
                  ∞
                </p>
              </div>
            </header>

            {/* artwork — the pixel park, framed */}
            <div className="relative mt-3 overflow-hidden rounded-[0.7rem] border-2 border-[#ffd94a]/60">
              <Image
                src="/hero/park-cta-v2.jpg"
                alt=""
                width={1280}
                height={720}
                className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-[#0c1f16]/45 via-transparent to-transparent"
              />
              <span className="absolute bottom-1.5 right-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                On duty · 3:00 AM
              </span>
            </div>

            {/* moves */}
            <ul className="mt-3 space-y-1.5">
              {MOVES.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-black leading-tight text-white">
                      {m.name}
                    </p>
                    <p className="truncate text-[10.5px] font-medium text-white/55">
                      {m.desc}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[12px] font-black text-[#ffd94a]">
                    {m.power}
                  </span>
                </li>
              ))}
            </ul>

            {/* flavor + set line */}
            <footer className="mt-3 border-t border-white/12 pt-2.5">
              <p className="font-mono text-[9.5px] italic leading-relaxed text-white/45">
                And when a lead goes quiet, it follows up on its own.
              </p>
              <div className="mt-2 flex items-center justify-between font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/40">
                <span>Never sleeps · Never quits</span>
                <span className="text-[#ffd94a]/90">Holo ★</span>
              </div>

              {/* the card's own move: summon the founders */}
              <LaunchDemoButton className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] text-[13px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]">
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Book a Demo
              </LaunchDemoButton>
            </footer>

            {/* HOLO FOIL — rainbow sheet that slides with the pointer */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: hovering ? 0.55 : 0,
                mixBlendMode: "color-dodge",
                background:
                  "linear-gradient(115deg, transparent 18%, rgba(255,64,255,0.55) 33%, rgba(64,255,255,0.55) 46%, rgba(255,237,64,0.5) 59%, rgba(64,255,140,0.5) 70%, transparent 84%)",
                backgroundSize: "260% 260%",
                backgroundPosition:
                  "calc(var(--px) * 100%) calc(var(--py) * 100%)",
              }}
            />
            {/* GLARE — soft white spotlight under the cursor */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: hovering ? 1 : 0,
                mixBlendMode: "overlay",
                background:
                  "radial-gradient(420px circle at calc(var(--px) * 100%) calc(var(--py) * 100%), rgba(255,255,255,0.55), transparent 55%)",
              }}
            />
          </div>
        </article>

        {/* the hint chip — invites the hover */}
        <p className="mt-4 text-center font-mono text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 transition-colors group-hover:text-ink/70">
          {hovering ? "★ Shiny ★" : "Move to inspect the holo"}
        </p>
      </div>
    </div>
  );
}
