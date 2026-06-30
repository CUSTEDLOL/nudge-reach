"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { ButtonLink } from "./button";
import { Reveal } from "./motion-primitives";
import { cn } from "@/lib/cn";

type Billing = "monthly" | "annual";

type Tier = {
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  cta: string;
  variant: "secondary" | "primary";
  popular?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    tagline: "For a single counter finding its feet on WhatsApp.",
    monthly: 0,
    annual: 0,
    cta: "Join the waitlist",
    variant: "secondary",
    features: [
      "1 WhatsApp number",
      "Shared inbox · 2 seats",
      "Photo → campaign generator",
      "First campaign free",
      "Basic delivery analytics",
    ],
  },
  {
    name: "Growth",
    tagline: "For teams turning conversations into revenue.",
    monthly: 2499,
    annual: 1999,
    cta: "Book a demo",
    variant: "primary",
    popular: true,
    features: [
      "Up to 3 numbers",
      "Unlimited inbox seats",
      "Automations & workflows",
      "Broadcasts & template library",
      "Full analytics + revenue",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    tagline: "For multi-location brands and serious volume.",
    monthly: null,
    annual: null,
    cta: "Talk to sales",
    variant: "secondary",
    features: [
      "Unlimited numbers",
      "Roles, permissions & SLAs",
      "Dedicated success manager",
      "API & custom integrations",
      "Onboarding & migration",
    ],
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("annual");

  return (
    <Section id="pricing" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="Simple, transparent pricing"
          title={
            <>
              Priced for shops, <span className="text-gradient">not enterprises</span>
            </>
          }
          subtitle="Start free, upgrade when WhatsApp starts paying for itself. Message costs are passed through at cost — shown in ₹ before every send."
        />

        {/* billing toggle */}
        <Reveal delay={0.1} className="mt-9 flex items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-black/5 bg-brand-50/70 p-1">
            {(["monthly", "annual"] as Billing[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                className={cn(
                  "relative rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors",
                  billing === b ? "text-white" : "text-ink/60 hover:text-ink"
                )}
              >
                {billing === b && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-brand-500 shadow-soft"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{b}</span>
              </button>
            ))}
          </div>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-[12px] font-bold text-brand-700">
            Save 20%
          </span>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => {
            const price =
              billing === "monthly" ? tier.monthly : tier.annual;
            const card = (
              <div
                className={cn(
                  "flex h-full flex-col rounded-[1.75rem] p-7",
                  tier.popular
                    ? "bg-brand-950 text-white shadow-lift"
                    : "border border-black/5 bg-white shadow-soft"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={cn(
                      "text-lg font-semibold",
                      tier.popular ? "text-white" : "text-ink"
                    )}
                  >
                    {tier.name}
                  </h3>
                  {tier.popular && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1 text-[11px] font-bold text-brand-950">
                      <Sparkles className="h-3 w-3" /> Most popular
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-2 min-h-10 text-[14px] leading-snug",
                    tier.popular ? "text-brand-100/70" : "text-ink/55"
                  )}
                >
                  {tier.tagline}
                </p>

                <div className="mt-6 flex items-end gap-1.5">
                  {price === null ? (
                    <span
                      className={cn(
                        "text-4xl font-bold tracking-tight",
                        tier.popular ? "text-white" : "text-ink"
                      )}
                    >
                      Custom
                    </span>
                  ) : price === 0 ? (
                    <span
                      className={cn(
                        "text-4xl font-bold tracking-tight",
                        tier.popular ? "text-white" : "text-ink"
                      )}
                    >
                      Free
                    </span>
                  ) : (
                    <>
                      <motion.span
                        key={`${tier.name}-${billing}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          "text-4xl font-bold tracking-tight",
                          tier.popular ? "text-white" : "text-ink"
                        )}
                      >
                        ₹{price.toLocaleString("en-IN")}
                      </motion.span>
                      <span
                        className={cn(
                          "mb-1 text-[13px]",
                          tier.popular ? "text-brand-100/60" : "text-ink/45"
                        )}
                      >
                        /mo{billing === "annual" ? " · billed yearly" : ""}
                      </span>
                    </>
                  )}
                </div>

                <ButtonLink
                  href="#get-started"
                  variant={tier.popular ? "primary-dark" : tier.variant}
                  className="mt-6 w-full"
                >
                  {tier.cta}
                </ButtonLink>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                          tier.popular
                            ? "bg-brand-400/20 text-brand-300"
                            : "bg-brand-100 text-brand-600"
                        )}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span
                        className={cn(
                          "text-[14px]",
                          tier.popular ? "text-brand-100/85" : "text-ink/70"
                        )}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );

            return (
              <Reveal key={tier.name} delay={i * 0.1} className="h-full">
                {tier.popular ? (
                  <div className="relative h-full rounded-[1.85rem] p-[1.5px]">
                    <div className="ring-aurora animate-spin-slow absolute inset-0 rounded-[1.85rem] opacity-90" />
                    <div className="relative h-full rounded-[1.8rem] bg-brand-950">
                      {card}
                    </div>
                  </div>
                ) : (
                  card
                )}
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2} className="mt-8 text-center">
          <p className="text-[13.5px] text-ink/50">
            All plans run in simulation first — try the full flow with zero risk
            before a single real message goes out.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
