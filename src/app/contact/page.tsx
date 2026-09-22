import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { metadataFor } from "@/modules/marketing/seo-pages";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { whatsappHref } from "@/components/marketing/contact-links";

export const metadata: Metadata = metadataFor("/contact");

/**
 * Two ways to reach us and nothing to fill in. A contact form is the wrong
 * artefact for a company whose whole pitch is "message us and you get an
 * answer in under a minute" — so the page is the pitch: book a time, or
 * start a WhatsApp thread that our own agent picks up.
 */
export default function ContactPage() {
  return (
    <>
      <ScrollTop />
      <Navbar />
      <main className="bg-[#f8fbf1] pt-24">
        <section className="mx-auto w-full max-w-2xl px-5 py-20 sm:py-28">
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Talk to us
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink/70">
            Book a time and we&apos;ll walk you through it, or message us on
            WhatsApp — our own AI Front Desk answers, so you get to see the
            product before you buy it.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <BookDemoButton surface="contact" variant="primary" size="lg">
              Book a Demo
            </BookDemoButton>

            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white px-6 py-3 text-[15px] font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_12px_32px_-14px_rgba(10,31,26,0.35)]"
            >
              <MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden />
              Reach out on WhatsApp
            </a>
          </div>

          <p className="mt-6 text-sm text-ink/50">
            Prefer to try it first?{" "}
            <a href="/free-trial" className="font-semibold text-ink underline underline-offset-4">
              Start a free trial
            </a>{" "}
            — no call needed.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
