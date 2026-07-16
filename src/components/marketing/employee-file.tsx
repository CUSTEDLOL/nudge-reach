"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "./button";
import { Container, Section } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE EMPLOYEE FILE
 * The site's one-liner is "it's not software, it's your best employee"
 * — so this section IS that document. An ID card for the hire, an
 * experience ledger (each industry = one real WhatsApp exchange), skill
 * stamps. Ink on paper, one green accent, real UI as the only art.
 * Replaces the old feature bento + industries showcase.
 * ------------------------------------------------------------------ */

type Experience = {
  title: string;
  period: string;
  outcome: string;
  chat: { inbound: string; reply: string; status: string };
};

const EXPERIENCE: Experience[] = [
  {
    title: "Aesthetic & dental clinics",
    period: "high-ticket consults",
    outcome: "Every ₹40,000 lead answered in seconds and chased until the consult books.",
    chat: {
      inbound: "How much is a hair transplant? Saw your ad.",
      reply: "Depends on grafts — most cases ₹35–60k. Dr. Mehta has a free consult Thu 6 PM. Book it?",
      status: "Consult booked · reminder set",
    },
  },
  {
    title: "Salons & spas",
    period: "repeat bookings",
    outcome: "Chairs stay full: confirmations, evening-before reminders, rebooking nudges.",
    chat: {
      inbound: "Any slot tomorrow evening?",
      reply: "4:30 PM with Priya is open — booked you in ✓",
      status: "No-show risk: reminded",
    },
  },
  {
    title: "Education & coaching",
    period: "admissions season",
    outcome: "Enquiries answered before parents call the next institute.",
    chat: {
      inbound: "Fees for the NEET batch?",
      reply: "₹45,000/year — free demo class Sat 11 AM. Reserve a seat?",
      status: "Demo class reserved",
    },
  },
  {
    title: "Real estate",
    period: "portal leads",
    outcome: "Answered in seconds, chased through the weeks buyers take to decide.",
    chat: {
      inbound: "Is the 2BHK in Andheri still available?",
      reply: "Yes — site visit Sunday 11 AM? I'll send the location pin.",
      status: "Site visit scheduled",
    },
  },
  {
    title: "Local services",
    period: "quotes & jobs",
    outcome: "Quotes out instantly, deposits collected, “reaching in 20 min” updates sent.",
    chat: {
      inbound: "How much for AC servicing?",
      reply: "₹599 — technician free tomorrow 10 AM. Book it?",
      status: "₹200 deposit collected",
    },
  },
];

const SKILLS = [
  "Books real calendars",
  "Chases quiet leads",
  "Collects payments",
  "Hinglish · हिन्दी · English",
  "STOP-compliant",
  "Never sleeps",
];

const ID_FIELDS: [string, string][] = [
  ["Employee", "The AI Front Desk"],
  ["Emp №", "0001 · first of its kind"],
  ["Shift", "24 / 7 / 365 — nights included"],
  ["Salary", "a third of a receptionist"],
  ["Sick days", "none, ever"],
];

function WhatsAppExchange({ chat }: { chat: Experience["chat"] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#efe7dd] p-3.5">
      <div className="wa-tail wa-tail-in relative max-w-[85%] self-start rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {chat.inbound}
      </div>
      <div className="wa-tail wa-tail-out relative max-w-[85%] self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {chat.reply}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 self-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-ink/70">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-500">
          <Check className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
        {chat.status}
      </div>
    </div>
  );
}

export function EmployeeFile() {
  const [open, setOpen] = useState(0);
  const reduce = useReducedMotionSafe();

  return (
    <Section id="features" className="border-t border-ink/10 bg-white">
      <Container>
        {/* ---- file header ---- */}
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 border border-ink/20 px-4 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/60">
            Confidential · Employee file
          </span>
          <h2 className="mt-7 font-display text-[2.3rem] font-black uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-[3.2rem]">
            Meet your new hire.
          </h2>
          <p className="serif-display mt-3 text-[1.5rem] text-ink/75 sm:text-[1.9rem]">
            Works nights. Never calls in sick.
          </p>
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-6xl items-start gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          {/* ---- the ID card ---- */}
          <Reveal className="lg:sticky lg:top-28">
            <div className="relative mx-auto max-w-sm -rotate-1 rounded-2xl border border-ink/12 bg-white p-6 shadow-[0_30px_60px_-36px_rgba(10,31,26,0.4)]">
              {/* punched lanyard slot */}
              <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-ink/10" />
              {/* photo: the employee IS the chat */}
              <div className="relative grid h-40 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
                <svg viewBox="0 0 24 24" className="h-16 w-16 text-white" fill="none" aria-hidden>
                  <path
                    d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.5L6 21v-3H5A1.5 1.5 0 0 1 3.5 16.5V7A1.5 1.5 0 0 1 5 5.5Z"
                    fill="currentColor"
                  />
                  <circle cx="9" cy="11.5" r="1.1" fill="#0b3d2e" />
                  <circle cx="12.5" cy="11.5" r="1.1" fill="#0b3d2e" />
                  <circle cx="16" cy="11.5" r="1.1" fill="#0b3d2e" />
                </svg>
                <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#07261c]/80 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-300 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
                  </span>
                  On shift
                </span>
              </div>

              <dl className="mt-6 divide-y divide-ink/[0.07]">
                {ID_FIELDS.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                      {k}
                    </dt>
                    <dd className="text-right text-[14px] font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* barcode */}
              <div
                aria-hidden
                className="mt-5 h-9 w-full rounded-sm opacity-80"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #0a1f1a 0 2px, transparent 2px 5px, #0a1f1a 5px 8px, transparent 8px 10px, #0a1f1a 10px 11px, transparent 11px 16px)",
                }}
              />
              <p className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.3em] text-ink/35">
                nudge · ai front desk
              </p>

              {/* approval stamp */}
              <div className="pointer-events-none absolute -right-4 -top-4 rotate-12 rounded border-2 border-brand-600/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700/80">
                Approved
              </div>
            </div>
          </Reveal>

          {/* ---- experience ledger ---- */}
          <div id="industries" className="scroll-mt-28">
            <Reveal>
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/40">
                Prior experience — tap a role
              </p>
            </Reveal>
            <ul className="mt-4 border-t border-ink/10">
              {EXPERIENCE.map((exp, i) => {
                const on = i === open;
                return (
                  <li key={exp.title} className="border-b border-ink/10">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      aria-expanded={on}
                      className="group flex w-full items-baseline gap-4 py-5 text-left"
                    >
                      <span className="font-mono text-[11px] font-semibold text-ink/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "serif-display text-[1.35rem] leading-tight transition-colors duration-300 sm:text-[1.6rem]",
                          on ? "text-ink" : "text-ink/40 group-hover:text-ink/70"
                        )}
                      >
                        {exp.title}
                      </span>
                      <span className="ml-auto hidden shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/35 sm:block">
                        {exp.period}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.div
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-5 pb-6 pl-9 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
                            <p className="text-[14.5px] leading-relaxed text-ink/65">
                              {exp.outcome}
                            </p>
                            <WhatsAppExchange chat={exp.chat} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {/* skills — inspection stamps */}
            <Reveal className="mt-10">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/40">
                Verified skills
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {SKILLS.map((s, i) => (
                  <span
                    key={s}
                    className="border border-ink/20 px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/65"
                    style={{ transform: `rotate(${[-1.2, 0.8, -0.6, 1.1, -0.9, 0.5][i % 6]}deg)` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* ---- the ask ---- */}
        <Reveal className="mt-16 flex flex-col items-center gap-5 text-center">
          <p className="max-w-xl text-[15px] text-ink/60">
            We configure the{" "}
            <strong className="font-bold text-ink">
              knowledge, flows, templates and integrations
            </strong>{" "}
            for you — that&rsquo;s the &lsquo;done-for-you&rsquo; part.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/waitlist" variant="primary">
              Hire the Front Desk
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              See pricing
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
