import { Check, Sparkles } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { ButtonLink } from "./button";
import { Reveal } from "./motion-primitives";
import { RoiCalculator } from "./roi-calculator";
import { cn } from "@/lib/cn";

type Tier = {
  name: string;
  tagline: string;
  price: number;
  priceNote: string;
  popular?: boolean;
  featureIntro?: string;
  features: string[];
};

const TIERS: Tier[] = [
  {
    name: "Free",
    tagline: "Run WhatsApp properly from day one — no card, no expiry.",
    price: 0,
    priceNote: "free forever",
    features: [
      "1 WhatsApp number",
      "250 contacts",
      "500 campaign messages/mo",
      "Shared inbox + AI reply drafts",
      "2 automations",
      "2 team seats",
    ],
  },
  {
    name: "Starter",
    tagline: "For small teams making WhatsApp their main sales channel.",
    price: 999,
    priceNote: "per month",
    featureIntro: "Everything in Free, plus:",
    features: [
      "2,500 contacts",
      "3,000 campaign messages/mo",
      "5 team seats",
      "Unlimited automations",
      "Broadcasts + scheduling",
    ],
  },
  {
    name: "Growth",
    tagline: "For businesses running WhatsApp at serious volume.",
    price: 2499,
    priceNote: "per month",
    popular: true,
    featureIntro: "Everything in Starter, plus:",
    features: [
      "25,000 contacts",
      "30,000 campaign messages/mo",
      "15 team seats",
      "Webhooks + API access",
      "Analytics & agent performance",
    ],
  },
  {
    name: "Pro",
    tagline: "For brands where WhatsApp is the revenue engine.",
    price: 5999,
    priceNote: "per month",
    featureIntro: "Everything in Growth, plus:",
    features: [
      "Unlimited contacts",
      "Unlimited campaign messages",
      "Unlimited team seats",
      "Priority support",
    ],
  },
];

export function Pricing() {
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
          subtitle="Start free and upgrade inside the app the day you hit a limit. Meta's per-conversation charges are passed through at cost — shown in ₹ before every send."
        />

        <div className="mt-14 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4 xl:gap-5">
          {TIERS.map((tier, i) => {
            const card = (
              <div
                className={cn(
                  "flex h-full flex-col rounded-[1.75rem] p-6 xl:p-7",
                  tier.popular
                    ? "bg-brand-950 text-white shadow-lift"
                    : "border border-black/5 bg-white shadow-soft"
                )}
              >
                <div className="flex items-center justify-between gap-2">
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
                    "mt-2 min-h-[3.5rem] text-[13.5px] leading-snug",
                    tier.popular ? "text-brand-100/70" : "text-ink/55"
                  )}
                >
                  {tier.tagline}
                </p>

                <div className="mt-5 flex items-end gap-1.5">
                  <span
                    className={cn(
                      "text-[2.15rem] font-bold leading-none tracking-tight",
                      tier.popular ? "text-white" : "text-ink"
                    )}
                  >
                    ₹{tier.price.toLocaleString("en-IN")}
                  </span>
                  <span
                    className={cn(
                      "mb-0.5 text-[13px]",
                      tier.popular ? "text-brand-100/60" : "text-ink/45"
                    )}
                  >
                    {tier.priceNote}
                  </span>
                </div>

                <ButtonLink
                  href="/login"
                  variant={tier.popular ? "primary-dark" : "secondary"}
                  className="mt-6 w-full"
                >
                  Start free
                </ButtonLink>

                {tier.featureIntro && (
                  <p
                    className={cn(
                      "mt-6 text-[12px] font-bold uppercase tracking-[0.12em]",
                      tier.popular ? "text-brand-300" : "text-brand-700"
                    )}
                  >
                    {tier.featureIntro}
                  </p>
                )}
                <ul className={cn("space-y-2.5", tier.featureIntro ? "mt-3" : "mt-6")}>
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
                          "text-[13.5px] leading-snug",
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
              <Reveal key={tier.name} delay={i * 0.08} className="h-full">
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

        <Reveal delay={0.15} className="mt-8 text-center">
          <p className="text-[13.5px] text-ink/50">
            Prices in INR, billed monthly, cancel anytime. Every plan includes
            simulation mode, opt-in enforcement and the official WhatsApp Cloud API.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-16 sm:mt-20">
          <RoiCalculator />
        </Reveal>
      </Container>
    </Section>
  );
}
