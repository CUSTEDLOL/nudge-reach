import type { Metadata } from "next";
import { metadataFor } from "@/modules/marketing/seo-pages";
import { Navbar } from "@/components/marketing/navbar";
import { Pricing } from "@/components/marketing/pricing";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = metadataFor("/pricing");

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
