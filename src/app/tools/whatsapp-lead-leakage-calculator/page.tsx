import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/marketing/seo/json-ld";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import { metadataFor } from "@/modules/marketing/seo-pages";
import { breadcrumbJsonLd } from "@/modules/marketing/structured-data";

import { LeadLeakageCalculator } from "./lead-leakage-calculator";

const path = "/tools/whatsapp-lead-leakage-calculator";
const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "WhatsApp AI automation", path: "/whatsapp-ai-automation" },
  { name: "Lead leakage calculator", path },
];

export const metadata: Metadata = metadataFor(path);

export default function WhatsAppLeadLeakageCalculatorPage() {
  return (
    <>
      <JsonLd value={breadcrumbJsonLd(breadcrumbs)} />
      <LandingShell
        breadcrumbs={breadcrumbs}
        eyebrow="WhatsApp lead audit"
        title="WhatsApp lead leakage calculator"
        intro="Estimate how many WhatsApp enquiries may be lost between the first message and a consistent follow-up. This is a transparent planning estimate, not a revenue promise."
        ctaTitle="Turn each WhatsApp enquiry into a clear next action"
        ctaBody="Nudge's AI Front Desk answers from your business knowledge, captures lead context, takes approved actions and follows up with consent."
        surface="whatsapp-lead-leakage-calculator"
      >
        <div className="space-y-14 sm:space-y-20">
          <section aria-labelledby="calculator-heading">
            <div className="mb-8 max-w-3xl">
              <h2
                id="calculator-heading"
                className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
              >
                Audit the gaps in your lead response
              </h2>
              <p className="mt-4 leading-7 text-ink/65">
                Enter monthly averages below. Nothing is submitted: every result
                is calculated in this page in your browser.
              </p>
            </div>
            <LeadLeakageCalculator />
          </section>

          <section aria-labelledby="formula-heading" className="border-t-2 border-ink pt-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
                  Transparent assumptions
                </p>
                <h2
                  id="formula-heading"
                  className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl"
                >
                  How the estimate works
                </h2>
              </div>
              <div className="space-y-5 leading-7 text-ink/70">
                <p className="font-bold text-ink">
                  Missed replies → missing follow-up → potential customers →
                  revenue at risk
                </p>
                <p>
                  First, the calculator estimates leads without a timely reply.
                  It then applies the missing follow-up percentage only to leads
                  that did receive a reply. Those two gaps become leads at risk.
                </p>
                <p>
                  Leads at risk × your conversion rate estimates potential
                  customers at risk. That figure × average sale value estimates
                  monthly revenue at risk; the annual view multiplies it by 12.
                </p>
                <p>
                  Results are displayed in INR for consistency. You can interpret
                  the same formula in your own local currency: enter the average
                  sale value in that currency and read the numeric estimate in
                  the same currency.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="next-reading-heading" className="rounded-[1.75rem] bg-[#f8fbf1] p-7 sm:p-10">
            <h2
              id="next-reading-heading"
              className="text-2xl font-black tracking-tight text-ink sm:text-3xl"
            >
              Improve the workflow behind the estimate
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Link
                href="/whatsapp-ai-automation"
                className="rounded-2xl border-2 border-ink/70 bg-white p-6 font-bold text-ink outline-none transition-colors hover:bg-[#d3f8e0] focus-visible:ring-4 focus-visible:ring-brand-700/30"
              >
                Understand the complete WhatsApp AI automation flow
              </Link>
              <Link
                href="/resources/how-to-stop-losing-leads-on-whatsapp"
                className="rounded-2xl border-2 border-ink/70 bg-white p-6 font-bold text-ink outline-none transition-colors hover:bg-[#d3f8e0] focus-visible:ring-4 focus-visible:ring-brand-700/30"
              >
                Build a workflow that stops WhatsApp leads disappearing
              </Link>
            </div>
          </section>
        </div>
      </LandingShell>
    </>
  );
}
