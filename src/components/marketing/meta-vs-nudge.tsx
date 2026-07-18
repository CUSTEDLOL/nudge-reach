"use client";

import { useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Clock3, LockKeyhole, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";
import { BookDemoButton } from "./book-demo";

type BrandId =
  | "meta"
  | "aisensy"
  | "wati"
  | "interakt"
  | "haptik"
  | "hire"
  | "nudge";

type BrandPoint = {
  id: BrandId;
  name: string;
  sub: string;
  limitation: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  impactRotate: number;
  summary: string;
  proof: [string, string, string];
};

/** Qualitative positioning derived from the factual capability ledger this map
 * replaces. Coordinates communicate category, not a numerical score. */
const BRANDS: BrandPoint[] = [
  {
    id: "meta",
    name: "Meta AI",
    sub: "Free",
    limitation: "Answers",
    x: 31,
    y: 20,
    mobileX: 27,
    mobileY: 18,
    impactRotate: -4,
    summary: "A capable free answering layer — but still an inbound agent, not the operator of the desk.",
    proof: ["Answers common questions", "Learns from Meta surfaces", "Does not run external systems"],
  },
  {
    id: "aisensy",
    name: "AiSensy",
    sub: "CRM tool",
    limitation: "You operate it",
    x: 18,
    y: 43,
    mobileX: 22,
    mobileY: 34,
    impactRotate: 3.5,
    summary: "Strong WhatsApp campaign and CRM software whose workflows are configured and operated by your team.",
    proof: ["Campaign and inbox tooling", "Automation building blocks", "Owner or team runs the system"],
  },
  {
    id: "wati",
    name: "WATI",
    sub: "CRM tool",
    limitation: "You operate it",
    x: 29,
    y: 51,
    mobileX: 54,
    mobileY: 41,
    impactRotate: -3,
    summary: "A broad WhatsApp platform with integrations and automation, still sold as software to operate.",
    proof: ["Shared team inbox", "Workflow automation", "Setup and management stay with you"],
  },
  {
    id: "interakt",
    name: "Interakt",
    sub: "CRM tool",
    limitation: "You operate it",
    x: 40,
    y: 46,
    mobileX: 76,
    mobileY: 50,
    impactRotate: 4,
    summary: "Useful commerce and messaging software, but the business still drives campaigns, flows, and follow-up.",
    proof: ["Messaging and commerce tools", "Templates and broadcasts", "Human-operated workflows"],
  },
  {
    id: "haptik",
    name: "Haptik",
    sub: "Enterprise",
    limitation: "Enterprise setup",
    x: 56,
    y: 70,
    mobileX: 25,
    mobileY: 64,
    impactRotate: -2.5,
    summary: "Can deliver deeper custom action-taking systems, with enterprise implementation and economics.",
    proof: ["Custom enterprise agents", "Managed implementation", "Enterprise scope and price"],
  },
  {
    id: "hire",
    name: "A hire",
    sub: "Human desk",
    limitation: "9-hour shift",
    x: 75,
    y: 69,
    mobileX: 68,
    mobileY: 72,
    impactRotate: 3,
    summary: "A receptionist takes real actions and owns the job — but only while they are on shift.",
    proof: ["Books and collects manually", "Understands the whole desk", "Limited hours and throughput"],
  },
  {
    id: "nudge",
    name: "Nudge",
    sub: "AI Front Desk",
    limitation: "Runs it for you",
    x: 89,
    y: 89,
    mobileX: 72,
    mobileY: 89,
    impactRotate: -6,
    summary: "The done-for-you front desk: trained on the business, taking real actions, and chasing revenue around the clock.",
    proof: ["Books into the real calendar", "Chases quiet leads automatically", "Collects deposits and is set up for you"],
  },
];

const DEBRIS = [
  { x: -54, y: -34, r: -38 },
  { x: -28, y: 45, r: 62 },
  { x: 22, y: -48, r: 91 },
  { x: 48, y: 31, r: -75 },
  { x: 72, y: -18, r: 44 },
  { x: 10, y: 68, r: 112 },
];

export function MetaVsNudge() {
  const mapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(mapRef, { once: true, margin: "-15%" });
  const reduce = useReducedMotionSafe();
  const [selectedId, setSelectedId] = useState<BrandId>("nudge");
  const selected = BRANDS.find((brand) => brand.id === selectedId)!;

  return (
    <Section id="compare" className="overflow-x-clip border-t border-ink/10 bg-white">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[1.72rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            Answers are cheap.
            <span className="serif-display mt-3 block text-[1.45rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Running the desk isn&rsquo;t.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            The market is full of software that answers or helps you operate.
            Nudge sits in a different category: it takes real revenue actions
            and is set up to run the desk for you.
          </p>
        </Reveal>

        <div ref={mapRef} className="mx-auto mt-12 w-full min-w-0 max-w-6xl">
          <motion.figure
            className="market-map-shell relative w-full min-w-0 overflow-hidden rounded-[2rem] border-2 border-ink/20 bg-[#f7f5ed] shadow-[14px_14px_0_#c9f2d6]"
            animate={
              inView && !reduce
                ? {
                    x: [0, 0, -9, 7, -4, 2, 0],
                    rotate: [0, 0, -0.3, 0.24, -0.12, 0.05, 0],
                  }
                : undefined
            }
            transition={{ duration: 0.92, delay: 3.45, ease: "easeInOut" }}
            aria-label="Qualitative market map comparing how much a product acts for the business and how much owner operation it requires"
          >
            <div className="market-map-stage relative overflow-hidden">
              <div className="market-map-grid absolute inset-0" aria-hidden />
              <div
                className="absolute right-[2%] top-[2%] h-[48%] w-[42%] rounded-full bg-brand-300/20 blur-3xl"
                aria-hidden
              />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <line
                  x1="6"
                  y1="94"
                  x2="97"
                  y2="94"
                  stroke="rgba(10,31,26,0.72)"
                  strokeWidth="0.55"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="6"
                  y1="96"
                  x2="6"
                  y2="4"
                  stroke="rgba(10,31,26,0.72)"
                  strokeWidth="0.55"
                  vectorEffect="non-scaling-stroke"
                />
                <path d="M97 94 94.5 92.8 94.5 95.2Z" fill="rgba(10,31,26,0.72)" />
                <path d="M6 4 4.8 7 7.2 7Z" fill="rgba(10,31,26,0.72)" />

                <path
                  d="M49 98 L82 5"
                  fill="none"
                  stroke="rgba(10,31,26,0.5)"
                  strokeWidth="1.1"
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                />

                <AnimatePresence mode="wait">
                  <motion.g
                    key={selected.id}
                    className="hidden sm:block"
                    initial={false}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.22 }}
                  >
                    <line
                      x1="6"
                      y1={100 - selected.y}
                      x2={selected.x}
                      y2={100 - selected.y}
                      stroke="rgba(6,193,103,0.42)"
                      strokeWidth="0.45"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={selected.x}
                      y1="94"
                      x2={selected.x}
                      y2={100 - selected.y}
                      stroke="rgba(6,193,103,0.42)"
                      strokeWidth="0.45"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </motion.g>
                </AnimatePresence>
              </svg>

              <span className="market-axis-label market-axis-y-top absolute left-[2.2%] top-[5%]">
                Takes revenue actions
              </span>
              <span className="market-axis-label absolute bottom-[2.5%] left-[8%]">
                You run it
              </span>
              <span className="market-axis-label absolute bottom-[2.5%] right-[3%] text-right">
                Runs for you
              </span>
              <span className="market-axis-label absolute bottom-[6%] left-[2.2%] -rotate-90 origin-left">
                Answers
              </span>

              <span
                className="market-ceiling-label absolute left-[57%] top-[45%] -rotate-[70deg] rounded-full border border-ink/20 bg-[#f7f5ed]/90 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink/55 shadow-sm sm:text-[10px]"
              >
                Software ceiling
              </span>

              <span className="absolute left-[9%] top-[9%] font-display text-[clamp(1.4rem,3vw,2.8rem)] font-black uppercase leading-none tracking-[-0.04em] text-ink/[0.07]">
                Action
                <br />depth
              </span>
              <span className="absolute bottom-[10%] right-[4%] text-right font-display text-[clamp(1.4rem,3vw,2.8rem)] font-black uppercase leading-none tracking-[-0.04em] text-brand-800/[0.08]">
                Front desk
                <br />territory
              </span>

              {BRANDS.map((brand, index) => {
                const isNudge = brand.id === "nudge";
                const isSelected = brand.id === selectedId;
                const delay = isNudge ? 3.02 : 0.52 + index * 0.18;
                return (
                  <div
                    key={brand.id}
                    className={cn(
                      "market-node absolute z-20",
                      inView && "is-playing",
                      isNudge && "is-nudge"
                    )}
                    style={
                      {
                        "--x": `${brand.x}%`,
                        "--y": `${brand.y}%`,
                        "--mx": `${brand.mobileX}%`,
                        "--my": `${brand.mobileY}%`,
                        "--impact-rotate": `${brand.impactRotate}deg`,
                        "--entry-delay": `${delay}s`,
                      } as CSSProperties
                    }
                  >
                    <motion.button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${brand.name}: ${brand.limitation}. Select for details.`}
                      onMouseEnter={() => setSelectedId(brand.id)}
                      onFocus={() => setSelectedId(brand.id)}
                      onClick={() => setSelectedId(brand.id)}
                      className={cn(
                        "market-node-chip group relative min-w-[7.2rem] rounded-2xl border px-3 py-2.5 text-left shadow-[0_10px_22px_-14px_rgba(10,31,26,0.55)] outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                        isNudge
                          ? "border-brand-800 bg-brand-500 text-white shadow-[0_18px_35px_-15px_rgba(6,193,103,0.8)]"
                          : "border-ink/25 bg-[#fffdf7] text-ink",
                        isSelected && !isNudge && "border-ink/60 shadow-[0_15px_30px_-16px_rgba(10,31,26,0.65)]"
                      )}
                      whileHover={
                        reduce
                          ? undefined
                          : {
                              scale: 1.07,
                              rotate: [0, -1.6, 1.4, -0.7, 0],
                              transition: { duration: 0.34 },
                            }
                      }
                      whileTap={{ scale: 0.96 }}
                    >
                      <span className="flex items-center gap-1.5 font-display text-[13px] font-black uppercase leading-none tracking-[-0.02em] sm:text-[15px]">
                        {isNudge && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                        {brand.name}
                      </span>
                      <span className={cn("mt-1 block text-[10px]", isNudge ? "text-white/75" : "text-ink/45")}>
                        {brand.sub}
                      </span>
                      <span
                        className={cn(
                          "mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.05em]",
                          isNudge ? "bg-white/18 text-white" : "bg-ink/[0.06] text-ink/55"
                        )}
                      >
                        {brand.id === "haptik" && <LockKeyhole className="h-2.5 w-2.5" aria-hidden />}
                        {brand.id === "hire" && <Clock3 className="h-2.5 w-2.5" aria-hidden />}
                        {brand.limitation}
                      </span>
                    </motion.button>
                  </div>
                );
              })}

              {!reduce &&
                DEBRIS.map((piece, index) => (
                  <motion.span
                    key={index}
                    className="absolute bottom-[76%] left-[79%] z-30 h-[3px] w-8 rounded-full bg-ink/65"
                    initial={{ opacity: 0, x: 0, y: 0, rotate: -68, scaleX: 0.2 }}
                    animate={
                      inView
                        ? {
                            opacity: [0, 1, 1, 0],
                            x: [0, piece.x],
                            y: [0, piece.y],
                            rotate: [-68, piece.r],
                            scaleX: [0.2, 1, 0.7],
                          }
                        : undefined
                    }
                    transition={{ duration: 0.88, delay: 3.48 + index * 0.035, ease: "easeOut" }}
                    aria-hidden
                  />
                ))}
            </div>

            <figcaption className="border-t border-ink/15 bg-white/75 px-4 py-3 text-center text-[11px] text-ink/45 backdrop-blur-sm sm:text-[12px]">
              Qualitative positioning based on action depth and owner effort.
              Select any brand to see why it sits there.
            </figcaption>
          </motion.figure>

          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={false}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "mt-5 grid min-w-0 gap-5 rounded-2xl border p-5 sm:grid-cols-[0.85fr_1.4fr] sm:p-6",
                selected.id === "nudge"
                  ? "border-brand-700/30 bg-brand-50"
                  : "border-ink/15 bg-[#f7f5ed]"
              )}
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">
                  Why it sits here
                </p>
                <h3 className="mt-2 font-display text-2xl font-black uppercase tracking-[-0.03em] text-ink">
                  {selected.name}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink/65">
                  {selected.summary}
                </p>
              </div>
              <ul className="grid min-w-0 gap-2.5 self-center sm:grid-cols-3">
                {selected.proof.map((item, index) => (
                  <li
                    key={item}
                    className="rounded-xl border border-ink/10 bg-white/75 p-3 text-[12px] font-semibold leading-snug text-ink/70 shadow-sm"
                  >
                    <span className="mr-1.5 font-mono text-[9px] text-brand-700">
                      0{index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-ink/50">
            Good tools still need an operator. Nudge is the operator: trained
            on your business, on shift around the clock, and set up for you.
          </p>
          <div className="mt-7 flex justify-center">
            <BookDemoButton variant="primary">
              Book a Demo — see it run yours
            </BookDemoButton>
          </div>
        </div>
      </Container>
    </Section>
  );
}
