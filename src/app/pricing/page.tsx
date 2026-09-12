import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Pricing } from "@/components/marketing/pricing";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Entry ₹1,499, Starter ₹4,499, Growth ₹7,499, Pro ₹14,999 a month. Every plan includes an AI that answers your WhatsApp around the clock. No setup fee.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <ScrollTop />
      <Navbar />
      <main className="bg-[#f8fbf1] pt-24">
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
