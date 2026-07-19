import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Pricing } from "@/components/marketing/pricing";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One implementation package, starting from ₹20,000 — we set up your AI Front Desk end-to-end. Book a demo to get a plan customized to your business.",
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
