import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { IndustryWordSearch } from "@/components/marketing/industry-word-search";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { Experience } from "@/components/marketing/v2/experience";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";
import { FinalCtaV2 } from "@/components/marketing/v2/final-cta-v2";
import { NightShift } from "@/components/marketing/v2/chapters/night-shift";
import { DaySection } from "@/components/marketing/v2/day-section";

export const metadata: Metadata = {
  title: "Nudge: the AI Front Desk that runs your WhatsApp",
  description:
    "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk runs it: books into your real calendar, chases every lead that goes quiet, collects payments, and we set the whole thing up. It's not software. It's your best employee, for a third of the salary.",
  alternates: { canonical: "/" },
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
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Nudge",
      url: "https://nudge-reach.vercel.app",
      logo: "https://nudge-reach.vercel.app/icon.svg",
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
        {
          "@type": "Offer",
          name: "AI Front Desk implementation",
          price: "20000",
          priceCurrency: "INR",
          description:
            "End-to-end setup of the AI Front Desk, starting from ₹20,000 — final plan customized per business.",
        },
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
          {/* pricing and FAQ live on their own pages, via the navbar */}
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
