"use client";

import { motion } from "motion/react";
import { Camera, Clock, Sparkles, Wand2 } from "lucide-react";
import { Container, Eyebrow } from "./section";
import { ButtonLink } from "./button";
import { WhatsAppCard } from "./whatsapp-card";
import { Float, Magnetic, Reveal } from "./motion-primitives";

const STEPS = [
  { n: "1", t: "Snap the product", d: "Any photo from your shelf — no studio, no designer." },
  { n: "2", t: "Nudge writes it", d: "Headline, offer, body and buttons — personalised & compliant." },
  { n: "3", t: "Review & send", d: "Tweak if you like, see the ₹ cost, send to opted-in customers." },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function PhotoToCampaign() {
  return (
    <section
      id="photo"
      className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-brand-50/60 to-white py-24 sm:py-28"
    >
      <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-40" />
      <Container className="relative z-10">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* copy */}
          <div>
            <Reveal>
              <Eyebrow>
                <Wand2 className="h-3.5 w-3.5" /> The signature move
              </Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                From shelf to send in{" "}
                <span className="text-gradient">under a minute</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/60">
                The feature that started it all. Point your camera at a product
                and Nudge turns it into a polished, Meta-compliant WhatsApp
                campaign — copy, creative and call-to-action included.
              </p>
            </Reveal>

            <div className="mt-9 space-y-5">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={0.15 + i * 0.1}>
                  <div className="flex items-start gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-soft">
                      {s.n}
                    </span>
                    <div>
                      <p className="text-[16px] font-semibold text-ink">{s.t}</p>
                      <p className="text-[14.5px] leading-relaxed text-ink/55">
                        {s.d}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.5} className="mt-9">
              <Magnetic>
                <ButtonLink href="#get-started" variant="primary" size="lg">
                  Turn a photo into a campaign
                </ButtonLink>
              </Magnetic>
            </Reveal>
          </div>

          {/* animated stage */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-200/50 to-transparent blur-3xl" />
            <div className="relative flex flex-col items-center gap-5">
              {/* input photo */}
              <Reveal className="w-full max-w-sm">
                <div className="flex items-center gap-3 rounded-3xl border border-black/5 bg-white p-3 shadow-lift">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#c8a24a,#9c1f3a)]">
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                      IMG_0421.jpg
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Camera className="h-4 w-4 text-brand-500" /> Product photo
                    </p>
                    <p className="mt-1 text-[12px] text-ink/50">
                      Banarasi silk dupatta · uploaded
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-50">
                      <motion.div
                        initial={{ width: "0%" }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, ease: EASE }}
                        className="h-full rounded-full bg-brand-500"
                      />
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* AI core */}
              <Reveal delay={0.25}>
                <div className="flex items-center gap-2.5 rounded-full border border-brand-200/70 bg-white px-4 py-2 shadow-soft">
                  <span className="relative grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-white">
                    <span className="absolute inset-0 animate-pulse-glow rounded-full bg-brand-400/50" />
                    <Sparkles className="relative h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-semibold text-ink">
                    Nudge AI is writing your campaign…
                  </span>
                </div>
              </Reveal>

              {/* output campaign */}
              <Reveal delay={0.4} className="relative w-full max-w-sm">
                <Float amount={8}>
                  <div className="mx-auto w-fit">
                    <span className="absolute -right-2 -top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-white shadow-lift">
                      <Clock className="h-3 w-3 text-brand-400" /> Generated in 4.2s
                    </span>
                    <WhatsAppCard />
                  </div>
                </Float>
              </Reveal>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
