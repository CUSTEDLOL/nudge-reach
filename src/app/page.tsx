import type { Metadata } from "next";
import Link from "next/link";
import { metadataFor } from "@/modules/marketing/seo-pages";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { EasySetup } from "@/components/marketing/easy-setup";
import { PlansStrip } from "@/components/marketing/plans-strip";
import { IndustryWordSearch } from "@/components/marketing/industry-word-search";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { Experience } from "@/components/marketing/v2/experience";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";
import { FinalCtaV2 } from "@/components/marketing/v2/final-cta-v2";
import { NightShift } from "@/components/marketing/v2/chapters/night-shift";
import { DaySection } from "@/components/marketing/v2/day-section";
import { Container } from "@/components/marketing/section";
import { getPlan, PLAN_PRICES, type PlanId } from "@/modules/billing/plans";

export const metadata: Metadata = {
  ...metadataFor("/"),
  openGraph: {
    title: "Nudge: your AI Front Desk on WhatsApp",
    description:
      "It books real appointments, chases quiet leads and collects payments on WhatsApp, set up for you. A third of a front-desk salary, and it never sleeps.",
    type: "website",
  },
};

/**
 * The Night Shift. One page, one 24-hour shift: scroll is time. The pinned
 * night section plays one WhatsApp conversation on a phone mock (DOM,
 * scroll-scrubbed) beside the chapter copy. Without JS/motion, the
 * default-visible CSS produces the complete static story.
 */
const inr = new Intl.NumberFormat("en-IN");

/** One JSON-LD Offer, priced from `modules/billing/plans` — the same source the app enforces. */
function offer(id: PlanId, description: string) {
  const plan = getPlan(id);
  const credits =
    plan.includedCredits === null
      ? ""
      : ` Includes ${inr.format(plan.includedCredits)} AI credits a month.`;
  return {
    "@type": "Offer",
    name: plan.name,
    price: String(PLAN_PRICES[id].INR),
    priceCurrency: "INR",
    description: description + credits,
  };
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Nudge",
      url: "https://nudgeagent.app",
      logo: "https://nudgeagent.app/icon.svg",
      description:
        "Nudge is an AI Front Desk for small businesses: it answers customers, books appointments, chases quiet leads and collects payments on WhatsApp.",
    },
    {
      "@type": "SoftwareApplication",
      name: "Nudge AI Front Desk",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "A done-for-you AI employee that runs a small business's WhatsApp: real calendar bookings, lead follow-ups and payment collection over the official WhatsApp Cloud API.",
      offers: [
        offer(
          "entry",
          "An AI chatbot trained on your business that answers customer questions around the clock, plus marketing templates. It does not book, collect or follow up.",
        ),
        offer(
          "starter",
          "AI replies and lead capture around the clock, shared inbox, contacts and campaigns. One WhatsApp number.",
        ),
        offer(
          "growth",
          "Everything in Starter plus real calendar bookings, payment links, automated follow-ups, lead scoring and CRM sync.",
        ),
        offer(
          "pro",
          "Everything in Growth plus the voice front desk, custom actions into your own systems and bring-your-own AI key.",
        ),
      ],
    },
  ],
};

export default function Home() {
  return (
    <div data-shift="day" className="v2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Navbar />
      <Experience />
      <main className="relative z-10 overflow-x-clip">
        {/* THE NIGHT — 11:47 PM → dawn */}
        <HeroV2 />
        <NightShift />
        {/* THE DAYLIGHT ZONE — features (the USP) → the honest comparison.
            The salary math lives on /pricing next to the plans. */}
        <div id="daylight">
          <DaySection>
            <FeaturesBento />
          </DaySection>
          <DaySection>
            <IndustryWordSearch />
          </DaySection>
          <DaySection>
            <MetaVsNudge />
          </DaySection>
          <DaySection>
            <EasySetup />
          </DaySection>
          <DaySection>
            <section
              aria-labelledby="home-learning-title"
              className="border-y border-ink/10 bg-[#f8fbf1] py-14 sm:py-16"
            >
              <Container>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:gap-16">
                  <h2
                    id="home-learning-title"
                    className="max-w-xl font-display text-[2rem] font-black leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.7rem]"
                  >
                    Learn the system behind an AI Front Desk
                  </h2>
                  <div className="border-t-2 border-ink pt-5">
                    <p className="max-w-2xl text-[15.5px] leading-7 text-ink/65">
                      See how official WhatsApp AI automation connects grounded
                      replies to lead context, business actions, compliant
                      follow-up and human handoff.
                    </p>
                    <Link
                      href="/whatsapp-ai-automation"
                      className="mt-5 inline-flex font-black text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                    >
                      Learn how WhatsApp AI automation works
                    </Link>
                  </div>
                </div>
              </Container>
            </section>
          </DaySection>
          <DaySection>
            <PlansStrip />
          </DaySection>
          {/* the full grid and the FAQ live on their own pages, via the navbar */}
        </div>
        {/* the closer — back in the hero's sky, one ask: early access */}
        <FinalCtaV2 />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
