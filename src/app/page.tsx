import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";
import { SalaryCalculator } from "@/components/marketing/salary-calculator";
import { Industries } from "@/components/marketing/industries";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { ResellerCTA } from "@/components/marketing/reseller-cta";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

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

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip bg-cream">
        {/* 1 — the AI-employee USP, product as hero */}
        <Hero />
        <SocialProof />
        {/* 2 — Meta's free AI vs. the AI Front Desk */}
        <MetaVsNudge />
        {/* 3 — the salary math */}
        <SalaryCalculator />
        {/* 4 — vertical proof (clinics/salons) + the full toolkit underneath */}
        <Industries />
        <FeaturesBento />
        {/* 5 — reseller channel, pricing, FAQ, legal */}
        <ResellerCTA />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
