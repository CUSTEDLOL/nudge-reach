"use client";

import { useRef } from "react";
import { CHAPTERS, type ChapterName } from "../progress";
import { gsap, motionAllowed, useGSAP } from "../gsap";
import { PhoneChat } from "./phone";

/* ------------------------------------------------------------------ */
/* Chapter → phone side. Panels sit on the opposite side of the box.   */
/* ------------------------------------------------------------------ */
const ORDER: ChapterName[] = ["answer", "book", "chase", "dawn"];
const PHONE_RIGHT: ChapterName[] = ["book", "dawn"];
const PAD = 16; // px inset the phone keeps from the box edge

/** t(chapter, 0→1) → story progress inside that chapter. */
const t = (name: ChapterName, f: number) => {
  const c = CHAPTERS[name];
  return c.start + f * (c.end - c.start);
};

/* ------------------------------------------------------------------ */
/* Panel 1 — It answers: questions floating in, all of them answered.  */
/* ------------------------------------------------------------------ */
const QUESTIONS = [
  "How much is a classic facial?",
  "Are you open tomorrow evening?",
  "Do you take insurance?",
  "Can I move my 11 AM?",
];

function AnswerPanel() {
  return (
    <div className="ns-panel ns-panel-right is-first flex flex-col justify-center gap-3">
      {QUESTIONS.map((q, i) => (
        <div
          key={q}
          className={`ns-pitem w-fit max-w-[90%] rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-[14px] font-medium text-ink/75 shadow-[0_12px_32px_-20px_rgba(10,15,13,0.4)] ${
            i % 2 ? "self-end rounded-br-md" : "self-start rounded-bl-md"
          }`}
        >
          {q}
        </div>
      ))}
      <div className="ns-pitem mt-2 flex w-fit items-center gap-1.5 self-center rounded-full bg-brand-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-brand-700">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
        </svg>
        Every question — answered in seconds
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 2 — It books: a straight-on calendar, a slot, a tick.         */
/* July 2026: the 1st falls on a Wednesday; the 18th is a Saturday.    */
/* ------------------------------------------------------------------ */
const JULY_OFFSET = 3;
const BOOKED_DAY = 18;

function DrawnTick({ ring, check, size }: { ring: string; check: string; size: string }) {
  return (
    <svg viewBox="0 0 36 36" className={size} aria-hidden>
      <circle
        className={ring}
        cx="18" cy="18" r="15.5"
        fill="none" stroke="#00a884" strokeWidth="2.4"
        pathLength="1" strokeDasharray="1" strokeLinecap="round"
      />
      <path
        className={check}
        d="M11 18.6l4.6 4.6L25 13.6"
        fill="none" stroke="#00a884" strokeWidth="2.8"
        pathLength="1" strokeDasharray="1" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function BookPanel() {
  return (
    <div className="ns-panel ns-panel-left flex flex-col items-center justify-center gap-4">
      <div className="ns-pitem w-full max-w-[21rem] rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(10,15,13,0.45)]">
        <div className="flex items-baseline justify-between pb-3">
          <p className="text-[15px] font-black tracking-tight text-ink">July</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/40">2026</p>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-[10px] font-bold text-ink/35">{d}</span>
          ))}
          {Array.from({ length: JULY_OFFSET }, (_, i) => (
            <span key={`o${i}`} />
          ))}
          {Array.from({ length: 31 }, (_, i) => {
            const day = i + 1;
            return (
              <span key={day} className="relative text-[12px] leading-7 text-ink/60">
                {day === BOOKED_DAY && (
                  <span className="ns-cal2-day absolute inset-0 z-10 m-auto flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 font-bold text-white">
                    {day}
                  </span>
                )}
                {day}
              </span>
            );
          })}
        </div>
      </div>
      <div className="ns-time-pill rounded-full bg-ink px-5 py-2 text-[13.5px] font-bold text-white shadow-lg">
        Saturday · 9:00 PM
      </div>
      <DrawnTick ring="ns-cal2-ring" check="ns-cal2-check" size="h-11 w-11" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 3 — It chases: quiet leads get caught, one by one.            */
/* ------------------------------------------------------------------ */
const LEADS = [
  { name: "Priya", note: "bridal trial", quiet: "quiet 3d", tint: "#e0812f" },
  { name: "Rahul", note: "root canal quote", quiet: "quiet 2d", tint: "#4f7df0" },
  { name: "Aisha", note: "Saturday slot", quiet: "no reply", tint: "#b05ecc" },
  { name: "Vikram", note: "asked for prices", quiet: "quiet 5d", tint: "#31a377" },
];

function ChasePanel() {
  return (
    <div className="ns-panel ns-panel-right flex flex-col justify-center gap-2.5">
      <p className="ns-pitem pb-1 text-[11px] font-black uppercase tracking-[0.16em] text-ink/40">
        Tonight&rsquo;s quiet leads
      </p>
      {LEADS.map((l) => (
        <div
          key={l.name}
          className="ns-pitem flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 shadow-[0_12px_32px_-22px_rgba(10,15,13,0.4)]"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ backgroundColor: l.tint }}
          >
            {l.name[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{l.name}</span>
            <span className="block truncate text-[11.5px] text-ink/50">{l.note}</span>
          </span>
          <span className="relative shrink-0">
            <span className="ns-lead-sent flex items-center gap-1 whitespace-nowrap rounded-full bg-[#e7f8ef] px-2.5 py-1 text-[10.5px] font-bold text-[#0a7a4b]">
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
                <path d="m9.55 17.05-5.3-5.3 1.4-1.4 3.9 3.9 8.8-8.8 1.4 1.4z" />
              </svg>
              follow-up sent
            </span>
            <span className="ns-lead-quiet absolute inset-0 flex items-center justify-center whitespace-nowrap rounded-full bg-ink/[0.06] text-[10.5px] font-semibold text-ink/45">
              {l.quiet}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 4 — It collects: the deposit lands; the rails it rides on.    */
/* Brand glyphs: official simple-icons path data (CC0).                */
/* ------------------------------------------------------------------ */
const RAILS: { name: string; color: string; path: string }[] = [
  {
    name: "Razorpay",
    color: "#0C2451",
    path: "M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z",
  },
  {
    name: "Stripe",
    color: "#635BFF",
    path: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  },
  {
    name: "WhatsApp Pay",
    color: "#25D366",
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  },
];

function CollectPanel() {
  return (
    <div className="ns-panel ns-panel-left flex flex-col items-center justify-center gap-4">
      <div className="ns-pitem flex w-full max-w-[21rem] items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(10,15,13,0.45)]">
        <DrawnTick ring="ns-pay-ring" check="ns-pay-check" size="h-11 w-11 shrink-0" />
        <div className="min-w-0">
          <p className="text-[17px] font-black tracking-tight text-ink">₹500 received</p>
          <p className="text-[12px] text-ink/50">Deposit · UPI · 6:49 AM</p>
        </div>
      </div>
      <p className="ns-pitem pt-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-ink/35">
        Works with
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {RAILS.map((r) => (
          <span
            key={r.name}
            className="ns-pitem inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink/80 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={r.color} aria-hidden>
              <path d={r.path} />
            </svg>
            {r.name}
          </span>
        ))}
        <span className="ns-pitem inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink/80 shadow-sm">
          <span className="flex flex-col gap-[2px]" aria-hidden>
            <span className="h-[3px] w-3.5 skew-x-[-18deg] rounded-sm bg-[#f4761f]" />
            <span className="h-[3px] w-3.5 skew-x-[-18deg] rounded-sm bg-[#0b8f47]" />
          </span>
          UPI
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The showcase box                                                    */
/* ------------------------------------------------------------------ */

/**
 * The bordered stage beside the copy rail. The phone starts on the left
 * and hops sides at every chapter boundary; the vacated half plays that
 * chapter's companion piece. One scrubbed timeline drives the phone's
 * travel, panel hand-offs and every panel-internal beat — all off the
 * same CHAPTERS spans as the copy rail and the chat itself. Desktop
 * only; on mobile the box dissolves and the phone rides bottom-center.
 * Without the motion gate everything stacks in flow, fully visible.
 */
export function Showcase() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const box = ref.current;
      const track = box?.closest<HTMLElement>(".ns-track");
      const phone = box?.querySelector<HTMLElement>(".ns-phone");
      if (!box || !track || !phone) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const panels = gsap.utils.toArray<HTMLElement>(".ns-panel", box);
        const rightX = () => box.clientWidth - phone.offsetWidth - PAD * 2;

        gsap.set(".ns-cal2-day", { scale: 0, transformOrigin: "50% 50%" });
        gsap.set(".ns-time-pill", { autoAlpha: 0, y: 12, scale: 0.9 });
        gsap.set([".ns-cal2-ring", ".ns-cal2-check", ".ns-pay-ring", ".ns-pay-check"], {
          strokeDashoffset: 1,
        });
        gsap.set(".ns-lead-quiet", { autoAlpha: 1 });
        gsap.set(".ns-lead-sent", { autoAlpha: 0 });

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

        // The phone's travel: left → right → left → right.
        PHONE_RIGHT.forEach((name) => {
          tl.to(phone, { x: () => rightX(), duration: 0.05, ease: "power2.inOut" }, CHAPTERS[name].start);
        });
        tl.to(phone, { x: 0, duration: 0.05, ease: "power2.inOut" }, CHAPTERS.chase.start);

        // Panel hand-offs + item staggers.
        panels.forEach((panel, i) => {
          const c = CHAPTERS[ORDER[i]];
          const fromX = panel.classList.contains("ns-panel-right") ? 44 : -44;
          if (i > 0) {
            tl.fromTo(
              panel,
              { autoAlpha: 0, x: fromX },
              { autoAlpha: 1, x: 0, duration: 0.035, ease: "power2.out" },
              c.start + 0.02
            );
          }
          // The last panel holds — the stage scrolls away with it still lit.
          if (ORDER[i] !== "dawn") {
            tl.to(panel, { autoAlpha: 0, duration: 0.025, ease: "power2.in" }, c.end - 0.06);
          }

          gsap.utils.toArray<HTMLElement>(".ns-pitem", panel).forEach((el, j) => {
            gsap.set(el, { autoAlpha: 0, y: 18 });
            tl.to(
              el,
              { autoAlpha: 1, y: 0, duration: 0.016, ease: "back.out(1.4)" },
              (i === 0 ? 0.02 : c.start + 0.04) + j * 0.012
            );
          });
        });

        // It books: the date pops, the slot pill lands, the tick draws.
        tl.to(".ns-cal2-day", { scale: 1, duration: 0.02, ease: "back.out(2)" }, t("book", 0.42));
        tl.to(".ns-time-pill", { autoAlpha: 1, y: 0, scale: 1, duration: 0.018, ease: "back.out(1.6)" }, t("book", 0.56));
        tl.to(".ns-cal2-ring", { strokeDashoffset: 0, duration: 0.03, ease: "none" }, t("book", 0.68));
        tl.to(".ns-cal2-check", { strokeDashoffset: 0, duration: 0.02, ease: "none" }, t("book", 0.8));

        // It chases: badges flip gray → green, one lead at a time.
        LEADS.forEach((_, j) => {
          const at = t("chase", 0.34 + j * 0.13);
          tl.to(gsap.utils.toArray<HTMLElement>(".ns-lead-quiet")[j], { autoAlpha: 0, duration: 0.014 }, at);
          tl.to(gsap.utils.toArray<HTMLElement>(".ns-lead-sent")[j], { autoAlpha: 1, duration: 0.014 }, at);
        });

        // It collects: the receipt's tick draws once the deposit lands.
        tl.to(".ns-pay-ring", { strokeDashoffset: 0, duration: 0.03, ease: "none" }, t("dawn", 0.5));
        tl.to(".ns-pay-check", { strokeDashoffset: 0, duration: 0.02, ease: "none" }, t("dawn", 0.62));
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className="ns-box" aria-label="The Front Desk at work, feature by feature">
      <span className="ns-box-cap">
        <span className="ns-box-cap-dot" aria-hidden />
        One WhatsApp number · a team of AI agents
      </span>
      <PhoneChat />
      <AnswerPanel />
      <BookPanel />
      <ChasePanel />
      <CollectPanel />
    </div>
  );
}
