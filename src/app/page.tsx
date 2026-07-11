import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { SalaryCalculator } from "@/components/marketing/salary-calculator";
import { Industries } from "@/components/marketing/industries";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { ResellerCTA } from "@/components/marketing/reseller-cta";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Experience } from "@/components/marketing/v2/experience";
import { HeroV2 } from "@/components/marketing/v2/hero-v2";
import { NightShift } from "@/components/marketing/v2/chapters/night-shift";
import { Morning } from "@/components/marketing/v2/chapters/morning";
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
export default function Home() {
  return (
    <div data-shift="day" className="v2-page">
      <Navbar />
      <Experience />
      <main className="relative z-10 overflow-x-clip">
        {/* THE NIGHT — 11:47 PM → dawn */}
        <HeroV2 />
        <NightShift />
        {/* THE MORNING — the payoff, then the daylight zone.
            Full-bleed sections, Apple-style scrubbed entrances:
            features (the USP) → the salary math → the honest comparison. */}
        <Morning />
        <div className="pb-16">
          <DaySection>
            <FeaturesBento />
          </DaySection>
          <DaySection>
            <SalaryCalculator />
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
