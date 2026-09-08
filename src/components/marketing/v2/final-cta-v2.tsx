"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { WhatsAppGlyph } from "@/components/marketing/holo-card";

/**
 * The closer: the pixel world panorama (Marina Bay Sands → Taj Mahal →
 * Eiffel → Burj Khalifa — the markets Nudge serves) filling the section,
 * fading into the site's cream at the bottom where the ask sits in dark
 * ink, Duna-style. One simple line, one dark Book-a-Demo button.
 */

export function FinalCtaV2() {
  return (
    <section
      aria-label="Book a demo"
      className="relative isolate flex min-h-[96svh] flex-col justify-end overflow-hidden bg-[#8ecdf0]"
    >
      {/* the scenery — upper band biased so the landmark skyline stays in view */}
      <Image
        src="/cta/bottom-cta.png"
        alt=""
        fill
        sizes="100vw"
        quality={100}
        className="object-cover object-[50%_26%] [image-rendering:pixelated]"
      />

      {/* fade into the site's cream so the ask reads in dark ink */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-b from-transparent via-[#faf9f5]/80 to-[#faf9f5]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-24 pt-[46svh] text-center sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65 }}
          className="serif-display text-[clamp(2.6rem,6vw,5rem)] leading-[1.05] tracking-[-0.02em] text-ink"
        >
          Your{" "}
          <span className="wa-word">
            <WhatsAppGlyph className="wa-logo" aria-hidden />
            WhatsApp
          </span>
          , handled.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/65"
        >
          It answers, books and follows up. You run the business.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.22 }}
          className="mt-9"
        >
          <BookDemoButton className="group/link inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-[16.5px] font-semibold text-white shadow-[0_18px_44px_-14px_rgba(10,15,13,0.55)] transition-all hover:-translate-y-0.5 hover:bg-neutral-800">
            Book a Demo
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5"
              aria-hidden
            />
          </BookDemoButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.36 }}
          className="mt-5 text-[13px] text-ink/45"
        >
          15 minutes. See it answer, book and follow up live.
        </motion.p>
      </div>
    </section>
  );
}
