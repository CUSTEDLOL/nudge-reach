import type { Metadata } from "next";
import { CreditCard, MessageSquare, ShieldCheck, Timer } from "lucide-react";
import { Footer } from "@/components/marketing/footer";
import { WhatsAppGlyph } from "@/components/marketing/holo-card";
import { FreeTrialSections } from "@/components/marketing/free-trial-sections";
import { Navbar } from "@/components/marketing/navbar";
import { ScrollTop } from "@/components/marketing/scroll-top";
import { Container } from "@/components/marketing/section";
import { TrialSignupForm } from "./trial-signup-form";

export const metadata: Metadata = {
  title: "Free AI Front Desk Trial | Nudge",
  description:
    "Teach Nudge about your business and test up to 15 grounded AI replies in a safe workspace. No card required.",
  alternates: { canonical: "/free-trial" },
  openGraph: { url: "/free-trial", type: "website" },
};

/** The four things a visitor arriving from an ad wants settled in one glance. */
const PROOF = [
  { icon: Timer, label: "7 days" },
  { icon: MessageSquare, label: "15 replies" },
  { icon: CreditCard, label: "No card required" },
  { icon: ShieldCheck, label: "No live WhatsApp connection" },
] as const;

/**
 * The acquisition page. It is a destination for paid traffic, so it wears the
 * landing page's chrome (navbar + footer) and its visual language — cream
 * ground, graph paper, black display caps over a softer second line, and the
 * signup form as the one bordered object with a hard shadow. Copy stays short:
 * the form is the point.
 */
export default function FreeTrialPage() {
  return (
    <>
      <ScrollTop />
      <Navbar />

      <main className="bg-[#f8fbf1]">
        <section className="relative overflow-hidden">
          {/* the site's graph paper, fading out of the white under the navbar */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,15,13,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(10,15,13,0.045)_1px,transparent_1px)] bg-[size:48px_48px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white to-transparent"
          />

          <Container className="relative grid gap-12 pb-16 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,26rem)] lg:gap-16 lg:pb-24 lg:pt-36">
            <div className="lg:pt-3">
              <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
                Free trial · Nothing to pay
              </span>

              <h1 className="mt-7 max-w-xl font-display text-[2.35rem] font-black uppercase leading-[0.95] tracking-[-0.035em] text-ink sm:text-[3.3rem]">
                A front desk that answers
                <span className="serif-display mt-2 block text-[1.85rem] normal-case tracking-[-0.02em] text-ink/70 sm:text-[2.5rem]">
                  before the lead goes cold.
                </span>
              </h1>

              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink/65">
                Teach it about your business, then ask it anything a customer
                would. You see the exact replies it would send.
              </p>

              <ul className="mt-9 flex flex-wrap gap-2.5">
                {PROOF.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-ink/70 bg-white px-3.5 py-2 text-[13px] font-black text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)]"
                  >
                    <Icon className="h-4 w-4 text-brand-700" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>

              {/* What the trial actually feels like, in no extra words. */}
              <div className="mt-10 max-w-md rounded-2xl border-2 border-ink/70 bg-white shadow-[6px_6px_0_rgba(10,15,13,0.82)]">
                <div className="flex items-center gap-2 border-b-2 border-ink/10 px-4 py-2.5">
                  <WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />
                  <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-ink/60">
                    A real trial reply
                  </span>
                </div>
                <div className="bg-dotgrid space-y-2.5 px-4 py-4">
                  <p className="max-w-[80%] rounded-2xl rounded-tl-md border border-ink/10 bg-[#f6f7f4] px-3.5 py-2.5 text-[13.5px] leading-snug text-ink">
                    Do you have anything Saturday morning?
                  </p>
                  <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[#d6f8c8] px-3.5 py-2.5 text-[13.5px] leading-snug text-ink">
                    Yes — 10:30 and 11:15 are open. Want me to hold one for you?
                  </p>
                </div>
              </div>
            </div>

            <div id="start-free-trial" className="scroll-mt-28">
              <div className="rounded-[1.5rem] border-2 border-ink/70 bg-white p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-7">
                <h2 className="font-display text-[1.5rem] font-black leading-tight tracking-[-0.025em] text-ink">
                  Create your workspace
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-ink/65">
                  It opens straight away. You train and test Nudge inside it.
                </p>
                <div className="mt-6">
                  <TrialSignupForm />
                </div>
              </div>
            </div>
          </Container>
        </section>

        <FreeTrialSections />
      </main>

      <Footer />
    </>
  );
}
