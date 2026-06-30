import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { ValueProps } from "@/components/marketing/value-props";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { DashboardShowcase } from "@/components/marketing/dashboard-showcase";
import { PhotoToCampaign } from "@/components/marketing/photo-to-campaign";
import { WorkflowFlow } from "@/components/marketing/workflow-flow";
import { TeamBenefits } from "@/components/marketing/team-benefits";
import { Testimonials } from "@/components/marketing/testimonials";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Nudge — The WhatsApp CRM your whole team runs on",
  description:
    "Unify every WhatsApp conversation, lead and campaign in one shared inbox. AI replies, automated follow-ups, broadcasts and revenue analytics — Meta-compliant by default.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nudge — The WhatsApp CRM your whole team runs on",
    description:
      "One shared inbox for every WhatsApp conversation, lead and campaign. AI replies, automations and revenue analytics, compliant by default.",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip bg-cream">
        <Hero />
        <SocialProof />
        <ValueProps />
        <FeaturesBento />
        <DashboardShowcase />
        <PhotoToCampaign />
        <WorkflowFlow />
        <TeamBenefits />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
