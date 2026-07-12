import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Pricing } from "@/components/marketing/pricing";
import { SalaryCalculator } from "@/components/marketing/salary-calculator";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "The AI Front Desk flagship plan, plus self-serve tiers from free. Priced against the salary it replaces, not against software.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <ScrollTop />
      <Navbar />
      <main className="bg-white pt-24">
        <Pricing />
        {/* The hire-vs-Nudge maths — the pricing argument, next to the prices. */}
        <SalaryCalculator />
      </main>
      <Footer />
    </>
  );
}
