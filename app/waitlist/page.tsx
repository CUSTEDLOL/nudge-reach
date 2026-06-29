import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/marketing/section";
import { Logo } from "@/components/marketing/logo";
import { LeadForm } from "@/components/marketing/lead-form";
import { WhatsAppCard } from "@/components/marketing/whatsapp-card";
import { Reveal } from "@/components/marketing/motion-primitives";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description:
    "Snap a product photo. Get a ready-to-send, WhatsApp-compliant campaign for your customers — in under a minute. Join the Nudge early-access waitlist.",
};

const WHY = [
  "No typing or design skills — just a photo",
  "Compliant with WhatsApp's rules, every time",
  "Transparent ₹ cost before you ever hit send",
  "Only messages customers who opted in",
  "Works in simulation first — zero risk",
  "Built for shops, not big marketing teams",
];

export default function WaitlistPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="relative z-10">
        <Container className="flex items-center justify-between py-5">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </Container>
      </header>

      <main className="bg-mesh relative flex-1 overflow-hidden">
        <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-40" />
        <Container className="relative z-10 grid items-center gap-12 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/70 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 shadow-soft backdrop-blur">
                Early access · Built for India 🇮🇳
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.07] tracking-tight text-ink sm:text-5xl">
                One product photo.{" "}
                <span className="font-display text-gradient italic">
                  A whole WhatsApp campaign.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/60">
                Snap a photo of what you sell. Nudge writes a ready-to-send,
                WhatsApp-compliant campaign for your customers — in under a
                minute. No typing, no designer, no tech.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {WHY.map((w) => (
                  <li key={w} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <span className="text-[14.5px] leading-snug text-ink/70">
                      {w}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.2} className="mt-9 hidden lg:block">
              <div className="w-fit -rotate-2">
                <WhatsAppCard className="max-w-[280px]" />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <LeadForm surface="waitlist-page" defaultIntent="waitlist" />
          </Reveal>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
