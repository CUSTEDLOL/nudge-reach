import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { FAQ } from "@/components/marketing/faq";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about the AI Front Desk — setup, WhatsApp compliance, calendars, payments and what happens when the AI doesn't know.",
  alternates: { canonical: "/faq" },
};

export default function FAQPage() {
  return (
    <>
      <ScrollTop />
      <Navbar />
      <main className="bg-cream pt-24">
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
