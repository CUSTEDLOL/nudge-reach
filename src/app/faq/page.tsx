import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { FAQ } from "@/components/marketing/faq";
import { FAQS } from "@/components/marketing/faq-data";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about the AI Front Desk: setup, WhatsApp compliance, calendars, payments and what happens when the AI doesn't know.",
  alternates: { canonical: "/faq" },
};

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
      <main className="bg-cream pt-24">
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
