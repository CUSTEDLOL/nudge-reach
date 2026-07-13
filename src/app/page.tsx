import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { Industries } from "@/components/marketing/industries";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { ResellerCTA } from "@/components/marketing/reseller-cta";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Experience } from "@/components/marketing/v2/experience";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";
import { NightShift } from "@/components/marketing/v2/chapters/night-shift";
import { DaySection } from "@/components/marketing/v2/day-section";

export const metadata: Metadata = {
  title: "Nudge — the AI Front Desk that runs your WhatsApp",
  description:
    "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk runs it — books into your real calendar, chases every lead that goes quiet, collects payments, and we set the whole thing up. It's not software. It's your best employee, for a third of the salary.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nudge — your AI Front Desk on WhatsApp",
    description:
      "It books real appointments, chases quiet leads and collects payments on WhatsApp — set up for you. A third of a front-desk salary, and it never sleeps.",
    type: "website",
  },
};

/**
 * The Night Shift. One page, one 24-hour shift: scroll is time. A persistent
 * WebGL world (Experience) grades from 11:47 PM night to 9:00 AM morning
 * behind server-rendered copy. Without JS/WebGL/motion, .v2-page's gradient
 * and the default-visible CSS produce the complete static story.
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
          name: "AI Front Desk",
          price: "14999",
          priceCurrency: "INR",
        },
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
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
      <Navbar overDark />
      <Experience />
      <main className="relative z-10 overflow-x-clip">
        {/* THE NIGHT — 11:47 PM → dawn */}
        <HeroV2 />
        <NightShift />
        {/* THE DAYLIGHT ZONE — features (the USP) → the honest comparison.
            The salary math lives on /pricing next to the plans. */}
        <div id="daylight" className="pb-16">
          <DaySection>
            <FeaturesBento />
          </DaySection>
          <DaySection>
            <MetaVsNudge />
          </DaySection>
          <DaySection>
            <Industries />
          </DaySection>
          <DaySection>
            <ResellerCTA />
          </DaySection>
          {/* pricing and FAQ live on their own pages, via the navbar */}
          {/* full-bleed dark closer — the page ends on the ask */}
          <DaySection>
            <FinalCTA />
          </DaySection>
        </div>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
