"use client";

import { useRef } from "react";
import { CHAPTERS } from "../progress";
import { gsap, motionAllowed, useGSAP } from "../gsap";

/* ------------------------------------------------------------------ */
/* The script: one continuous WhatsApp thread across the four chapters. */
/* `at` is story progress (0→1 across the pinned #night-shift track).   */
/* ------------------------------------------------------------------ */

type Item =
  | { kind: "chip"; at: number; text: string }
  | { kind: "in" | "out"; at: number; text: string; time: string }
  | { kind: "calendar"; at: number }
  | { kind: "pay"; at: number }
  | { kind: "receipt"; at: number; text: string };

const A = CHAPTERS.answer;
const B = CHAPTERS.book;
const C = CHAPTERS.chase;
const D = CHAPTERS.dawn;
/** t(chapter, 0→1) → story progress inside that chapter. */
const t = (c: { start: number; end: number }, f: number) =>
  c.start + f * (c.end - c.start);

const ITEMS: Item[] = [
  // It answers — 12:31 AM
  { kind: "chip", at: t(A, 0.16), text: "12:31 AM" },
  { kind: "in", at: t(A, 0.26), text: "Hi! Do you have anything tomorrow evening?", time: "12:31 AM" },
  { kind: "out", at: t(A, 0.44), text: "Hi Priya! ✨ Yes — we're open till 10 PM tomorrow.", time: "12:31 AM" },
  { kind: "in", at: t(A, 0.62), text: "How much is a classic facial?", time: "12:32 AM" },
  { kind: "out", at: t(A, 0.8), text: "₹1,800 for 50 minutes — cleanup and massage included.", time: "12:32 AM" },

  // It books — 2:15 AM
  { kind: "chip", at: t(B, 0.08), text: "2:15 AM" },
  { kind: "in", at: t(B, 0.18), text: "Okay — can you book me for 9 PM?", time: "2:15 AM" },
  { kind: "out", at: t(B, 0.38), text: "Done! Tomorrow at 9:00 PM with Ritu ✓", time: "2:15 AM" },
  { kind: "calendar", at: t(B, 0.56) },

  // It chases — 4:40 AM
  { kind: "chip", at: t(C, 0.08), text: "4:40 AM" },
  { kind: "out", at: t(C, 0.2), text: "PS — you asked about a bridal trial last week 💛 One Saturday slot left. Want it?", time: "4:40 AM" },
  { kind: "in", at: t(C, 0.5), text: "omg yes please, book it!", time: "4:52 AM" },
  { kind: "out", at: t(C, 0.68), text: "Booked — Saturday, 11:00 AM 🎉", time: "4:52 AM" },

  // It collects — 6:48 AM
  { kind: "chip", at: t(D, 0.08), text: "6:48 AM" },
  { kind: "out", at: t(D, 0.2), text: "Here's a ₹500 deposit link to lock your slots 🔒", time: "6:48 AM" },
  { kind: "pay", at: t(D, 0.34) },
  { kind: "receipt", at: t(D, 0.56), text: "₹500 received · UPI · 6:49 AM" },
  { kind: "out", at: t(D, 0.72), text: "See you at 9, Priya ✨", time: "6:50 AM" },
];

/** Incoming messages flip the header to "typing…" just before they land. */
const TYPING_LEAD = 0.03;

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                          */
/* ------------------------------------------------------------------ */

function Ticks() {
  return (
    <svg viewBox="0 0 16 11" className="ml-1 inline-block h-[11px] w-4 shrink-0 fill-[#53bdeb]" aria-hidden>
      <path d="M11.07.65 5.4 8.02 3.35 5.9a.6.6 0 0 0-.87.83l2.53 2.63a.6.6 0 0 0 .9-.05L12.02 1.4a.6.6 0 1 0-.95-.74Z" />
      <path d="M15.07.65 9.4 8.02l-.44-.45-.75.98.7.72a.6.6 0 0 0 .9-.05L16.02 1.4a.6.6 0 1 0-.95-.74Z" />
    </svg>
  );
}

function Meta({ time, out }: { time: string; out?: boolean }) {
  return (
    <span className="float-right ml-2 mt-[7px] flex items-center text-[10px] leading-none text-[#667781]">
      {time}
      {out && <Ticks />}
    </span>
  );
}

function CalendarCard() {
  return (
    <div className="w-[82%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] p-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
      <div className="rounded-md bg-white/95 p-3">
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#00a884]" aria-hidden>
            <path d="M17 3h-1V2a1 1 0 1 0-2 0v1H10V2a1 1 0 1 0-2 0v1H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Zm1 15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h12v9Z" />
          </svg>
          <p className="text-[12px] font-semibold text-[#111b21]">Appointment confirmed</p>
        </div>
        <div className="flex items-center gap-3 pt-2.5">
          <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-[#f0f2f5]">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#ea5455]">Sat</span>
            <span className="text-[19px] font-bold leading-none text-[#111b21]">18</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-[#111b21]">9:00 PM — Classic Facial</p>
            <p className="text-[11px] text-[#667781]">with Ritu · 50 min</p>
          </div>
          <svg viewBox="0 0 36 36" className="h-8 w-8 shrink-0" aria-hidden>
            <circle
              className="ns-cal-ring"
              cx="18" cy="18" r="15.5"
              fill="none" stroke="#00a884" strokeWidth="2.4"
              pathLength="1" strokeDasharray="1" strokeLinecap="round"
            />
            <path
              className="ns-cal-check"
              d="M11 18.6l4.6 4.6L25 13.6"
              fill="none" stroke="#00a884" strokeWidth="2.8"
              pathLength="1" strokeDasharray="1" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <Meta time="2:16 AM" out />
    </div>
  );
}

function PayCard() {
  return (
    <div className="w-[82%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] p-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
      <div className="rounded-md bg-white/95 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884]/10">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-[#00a884]" aria-hidden>
              <path d="M6 4h12v2.2H6zM6 7.6h12v2.2h-4.06c.4.5.68 1.1.8 1.8H18v2.2h-3.32c-.44 2.6-2.62 4.3-5.68 4.53L14.6 22h-3.1l-5.3-3.9v-2.06h2.6c1.9 0 3.1-.72 3.44-2.24H6v-2.2h6.2c-.36-1.2-1.5-1.8-3.4-1.8H6z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-[#111b21]">Booking deposit</p>
            <p className="text-[11px] text-[#667781]">nudge.pay · secure UPI</p>
          </div>
          <p className="text-[15px] font-bold text-[#111b21]">₹500</p>
        </div>
        <div className="mt-2.5 rounded-md bg-[#00a884] py-1.5 text-center text-[12px] font-semibold text-white">
          Pay ₹500
        </div>
      </div>
      <Meta time="6:48 AM" out />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The phone                                                            */
/* ------------------------------------------------------------------ */

/**
 * A WhatsApp-exact phone mock pinned beside the chapter copy. Every item
 * pops in at its story beat and the thread auto-scrolls — the whole
 * conversation is a pure function of scroll, like everything else here.
 * Without the motion gate (.jsm) it falls back to a scrollable, fully
 * visible transcript.
 */
export function PhoneChat() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const root = ref.current;
      const track = root?.closest<HTMLElement>(".ns-track");
      const viewport = root?.querySelector<HTMLElement>(".ns-chat");
      const rail = root?.querySelector<HTMLElement>(".ns-rail");
      const status = root?.querySelector<HTMLElement>(".ns-status");
      if (!root || !track || !viewport || !rail || !status) return;

      const msgs = gsap.utils.toArray<HTMLElement>(".ns-msg", rail);
      // How far the rail must ride up so message i sits above the composer.
      const railY = (i: number) => {
        const el = msgs[i];
        return -Math.max(0, el.offsetTop + el.offsetHeight + 14 - viewport.clientHeight);
      };

      gsap.set(msgs, {
        autoAlpha: 0,
        y: 16,
        scale: 0.92,
        transformOrigin: (i: number) =>
          ITEMS[i].kind === "in" || ITEMS[i].kind === "chip" ? "0% 100%" : "100% 100%",
      });
      gsap.set([".ns-cal-ring", ".ns-cal-check"], { strokeDashoffset: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      tl.to({}, { duration: 1 });

      ITEMS.forEach((item, i) => {
        tl.to(
          msgs[i],
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.014, ease: "back.out(1.4)" },
          item.at
        );
        tl.to(rail, { y: () => railY(i), duration: 0.028, ease: "power2.out" }, item.at);

        // Header flips to "typing…" while Priya writes.
        if (item.kind === "in") {
          tl.set(status, { textContent: "typing…", color: "#00a884" }, item.at - TYPING_LEAD);
          tl.set(status, { textContent: "online", color: "#667781" }, item.at);
        }
        // The calendar tick draws itself right after the card lands.
        if (item.kind === "calendar") {
          tl.to(".ns-cal-ring", { strokeDashoffset: 0, duration: 0.03, ease: "none" }, item.at + 0.015);
          tl.to(".ns-cal-check", { strokeDashoffset: 0, duration: 0.02, ease: "none" }, item.at + 0.04);
        }
      });
    },
    { scope: ref }
  );

  // Consecutive-sender grouping: tight gap within a run, breathing room between.
  const gapClass = (i: number) =>
    i === 0 || ITEMS[i].kind !== ITEMS[i - 1].kind ? "mt-2" : "mt-[3px]";

  return (
    <div ref={ref} className="ns-phone" aria-label="A night of WhatsApp handled by the Front Desk">
      <div className="flex h-full flex-col overflow-hidden rounded-[2.1rem] bg-[#efeae2] font-[system-ui,-apple-system,'Segoe_UI',sans-serif]">
        {/* WhatsApp header */}
        <div className="z-10 flex items-center gap-2.5 bg-[#f7f8fa] px-3.5 pb-2.5 pt-3.5 shadow-[0_1px_2px_rgba(11,20,26,0.08)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f5b642] to-[#e0812f] text-[14px] font-bold text-white">
            P
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-[#111b21]">Priya</p>
            <p className="ns-status text-[11.5px] leading-tight text-[#667781]">online</p>
          </div>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#54656f]" aria-hidden>
            <path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3a6.5 6.5 0 1 0-6.5 6.5c1.6 0 3.2-.6 4.3-1.6l.3.3v.9l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
          </svg>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#54656f]" aria-hidden>
            <path d="M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          </svg>
        </div>

        {/* Chat viewport: doodle wallpaper + the scrolling thread */}
        <div className="ns-chat relative flex-1 overflow-y-auto overscroll-contain [.jsm_&]:overflow-hidden">
          <div className="ns-wallpaper" aria-hidden />
          <div className="ns-rail relative flex flex-col px-2.5 pb-3 pt-2.5">
            {ITEMS.map((item, i) => {
              const base = `ns-msg ${gapClass(i)}`;
              switch (item.kind) {
                case "chip":
                  return (
                    <div key={i} className={`${base} self-center rounded-lg bg-white/95 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`}>
                      {item.text}
                    </div>
                  );
                case "receipt":
                  return (
                    <div key={i} className={`${base} flex items-center gap-1.5 self-center rounded-lg bg-[#fdf4c5] px-3 py-1.5 text-[11px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`}>
                      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-[#00a884]" aria-hidden>
                        <path d="M12 2 4 5.5V11c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5.5L12 2zm-1.5 14.5-3.5-3.5 1.4-1.4 2.1 2.1 5.2-5.2 1.4 1.4-6.6 6.6z" />
                      </svg>
                      {item.text}
                    </div>
                  );
                case "calendar":
                  return <div key={i} className={base + " flex flex-col"}><CalendarCard /></div>;
                case "pay":
                  return <div key={i} className={base + " flex flex-col"}><PayCard /></div>;
                default: {
                  const out = item.kind === "out";
                  return (
                    <div
                      key={i}
                      className={`${base} wa-tail relative max-w-[80%] rounded-lg px-2.5 py-1.5 text-[13.5px] leading-[1.35] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                        out
                          ? "wa-tail-out self-end rounded-tr-none bg-[#d9fdd3]"
                          : "wa-tail-in self-start rounded-tl-none bg-white"
                      }`}
                    >
                      {item.text}
                      <Meta time={item.time} out={out} />
                    </div>
                  );
                }
              }
            })}
          </div>
        </div>

        {/* Composer (decorative) */}
        <div className="z-10 flex items-center gap-2 bg-[#f7f8fa] px-2.5 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-[7px]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#8696a0]" aria-hidden>
              <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.5 11A1.5 1.5 0 1 1 10 9.5 1.5 1.5 0 0 1 8.5 11zm7 0A1.5 1.5 0 1 1 17 9.5a1.5 1.5 0 0 1-1.5 1.5zm-8 3h9a4.5 4.5 0 0 1-9 0z" />
            </svg>
            <span className="flex-1 text-[13.5px] text-[#8696a0]">Message</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#8696a0]" aria-hidden>
              <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8-2h-2.6l-1.2-1.8A2 2 0 0 0 14.6 3H9.4a2 2 0 0 0-1.6 1.2L6.6 6H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-8 12a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
            </svg>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
