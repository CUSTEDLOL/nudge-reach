import type { Metadata } from "next";
import { metadataFor } from "@/modules/marketing/seo-pages";
import { Navbar } from "@/components/marketing/navbar";
import { FAQ } from "@/components/marketing/faq";
import { FAQS } from "@/components/marketing/faq-data";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = metadataFor("/faq");

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <ScrollTop />
      <Navbar />
      <main className="bg-[#f8fbf1] pt-24">
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
