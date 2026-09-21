import type { Metadata } from "next";
import { Check, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Footer } from "@/components/marketing/footer";
import { FreeTrialSections } from "@/components/marketing/free-trial-sections";
import { Navbar } from "@/components/marketing/navbar";
import { Container } from "@/components/marketing/section";
import { TrialSignupForm } from "./trial-signup-form";

export const metadata: Metadata = {
  title: "Free AI Front Desk Trial for Clinics | Nudge",
  description:
    "Teach Nudge about your clinic and test up to 15 grounded AI replies in a safe workspace. No card required.",
  alternates: { canonical: "/free-trial" },
  openGraph: { url: "/free-trial", type: "website" },
};

export default function FreeTrialPage() {
  return (
    <main className="min-h-dvh bg-white text-ink">
      <Navbar />
      <section data-hero className="relative overflow-hidden bg-[#071b14] pb-14 pt-28 text-white sm:pb-20 sm:pt-36">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:46px_46px]" />
        <Container className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,31rem)] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-semibold text-brand-200">
              <Sparkles className="h-4 w-4" aria-hidden /> A safe, guided trial for clinics
            </div>
            <h1 className="mt-6 max-w-3xl text-balance text-[2.65rem] font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[4.25rem]">
              {"Try Nudge on your clinic's real questions."}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/68">
              Teach your AI Front Desk the essentials, ask the questions patients actually send, and explore what it can run when you go live.
            </p>
            <p className="mt-6 text-sm font-bold text-white">
              7 days or 15 AI replies · No card required · Safe test workspace.
            </p>

            <div aria-label="Example trial conversation" className="mt-9 max-w-md rounded-2xl border border-white/12 bg-white/[0.055] p-4 shadow-[0_28px_80px_-42px_rgba(55,206,134,0.75)] backdrop-blur-sm">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-400 text-brand-950">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold">Aster Clinic AI</p>
                  <p className="text-xs text-white/45">Private test inbox</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-5">
                <p className="ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-sm bg-white px-4 py-3 text-ink">
                  Do you offer hair transplant consultations on Saturday?
                </p>
                <p className="w-fit max-w-[88%] rounded-2xl rounded-bl-sm bg-brand-500 px-4 py-3 text-white">
                  Yes. Consultations are available 10am–4pm. Would you like me to help with the next step?
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-300" aria-hidden />Your clinic context</span>
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden />Official WhatsApp API</span>
            </div>
          </div>

          <aside id="start-free-trial" className="scroll-mt-24 rounded-2xl border border-white/15 bg-white p-5 text-ink shadow-[0_28px_90px_-30px_rgba(0,0,0,0.75)] sm:p-7">
            <p className="text-sm font-bold text-brand-700">START FREE</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Create your test workspace</h2>
            <p className="mt-2 text-sm leading-6 text-ink/55">About two minutes. No WhatsApp connection needed.</p>
            <div className="mt-6">
              <TrialSignupForm />
            </div>
          </aside>
        </Container>
      </section>
      <FreeTrialSections />
      <Footer />
    </main>
  );
}
