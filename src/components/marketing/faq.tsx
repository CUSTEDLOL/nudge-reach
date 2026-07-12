"use client";

import { FAQS } from "./faq-data";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";
import { ButtonLink } from "./button";


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
