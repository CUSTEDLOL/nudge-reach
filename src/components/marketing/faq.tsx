"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";
import { ButtonLink } from "./button";

const FAQS = [
  {
    q: "Do I need a WhatsApp Business account to start?",
    a: "No — you can explore the entire product in simulation mode with no account at all. When you're ready to send real messages, you connect a WhatsApp Business number through the official Cloud API, and we walk you through every step.",
  },
  {
    q: "Is this compliant with WhatsApp's rules?",
    a: "Yes, by design. Nudge only messages contacts who have opted in, uses Meta-approved templates, and handles STOP requests automatically. Compliance is baked into every broadcast and automation — not bolted on.",
  },
  {
    q: "How much do messages actually cost?",
    a: "Meta charges per conversation. We pass that through at cost with no markup, and show you the exact ₹ estimate before you hit send — so there are never any surprises on your bill.",
  },
  {
    q: "Can my whole team work from it?",
    a: "Absolutely. The shared inbox supports seats, assignment, internal notes and live presence, so sales and support collaborate on the same conversations without stepping on each other.",
  },
  {
    q: "Will it work for my type of business?",
    a: "Nudge is built for SME retail and D2C — apparel, jewellery, food, décor, electronics, services and more. If your customers reach you on WhatsApp, it fits.",
  },
  {
    q: "How long does setup take?",
    a: "Most shops are live the same day. The photo → campaign generator works in minutes, and connecting your number is a short guided step.",
  },
  {
    q: "Is my data safe?",
    a: "Your conversations and customer data stay yours and are isolated per organisation. We never sell or share your data, full stop.",
  },
  {
    q: "Can I really start free?",
    a: "Yes — the Free plan gives you a WhatsApp number, 250 contacts, 500 campaign messages a month, the shared inbox with AI drafts, 2 automations and 2 seats. No card, no expiry. Upgrade inside the app only when you hit a limit.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" className="bg-cream">
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow="Questions, answered"
          title="Everything you're probably wondering"
        />

        <div className="mt-12 space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.04}>
                <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  >
                    <span className="text-[15.5px] font-semibold text-ink sm:text-base">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"
                    >
                      <Plus className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ink/60 sm:px-6">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[15px] text-ink/60">Still have a question?</p>
          <ButtonLink href="#get-started" variant="secondary">
            Talk to the team
          </ButtonLink>
        </Reveal>
      </Container>
    </Section>
  );
}
