"use client";

import { FAQS } from "./faq-data";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Container, Section } from "./section";
import { Reveal } from "./motion-primitives";
import { BookDemoButton } from "./book-demo";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" className="bg-[#f8fbf1]">
      <Container className="max-w-3xl">
        <div className="text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Questions, answered
          </span>
          <h1 className="mt-6 font-display text-[2.2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3.2rem]">
            Everything you&rsquo;re
            <br />
            <span className="text-ink/38">probably wondering</span>
          </h1>
        </div>

        <div className="mt-12 space-y-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.04}>
                <div
                  className={
                    "overflow-hidden rounded-2xl border-2 border-ink/70 bg-white shadow-[5px_5px_0_rgba(10,15,13,0.82)] transition-all duration-200 " +
                    (isOpen
                      ? "shadow-[7px_7px_0_rgba(10,15,13,0.82)]"
                      : "hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(10,15,13,0.82)]")
                  }
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6"
                  >
                    <span className="font-mono text-[11px] font-black text-ink/35">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[15.5px] font-black leading-snug text-ink sm:text-base">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-ink/70 bg-[#ffd94a] text-ink"
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
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
                        <p className="border-t-2 border-ink/10 px-5 pb-5 pt-4 text-[14.5px] leading-relaxed text-ink/65 sm:px-6 sm:pl-[3.4rem]">
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

        <Reveal
          delay={0.1}
          className="mt-12 flex flex-col items-center gap-4 text-center"
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
            Still have a question?
          </p>
          <BookDemoButton className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] px-7 text-[13.5px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]">
            Talk to the team
          </BookDemoButton>
        </Reveal>
      </Container>
    </Section>
  );
}
