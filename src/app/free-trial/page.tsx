import type { Metadata } from "next";
import Link from "next/link";
import { FreeTrialSections } from "@/components/marketing/free-trial-sections";
import { Logo } from "@/components/marketing/logo";
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
      <header className="border-b border-ink/10 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Logo />
          <Link
            href="/login"
            className="text-sm font-semibold text-ink/65 underline-offset-4 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          >
            Sign in
          </Link>
        </Container>
      </header>

      <section data-hero className="bg-white">
        <Container className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
          <div className="flex flex-col justify-center py-14 sm:py-20 lg:min-h-[42rem] lg:py-24 lg:pr-16 xl:pr-24">
            <h1 className="max-w-3xl text-balance text-[2.75rem] font-black leading-[0.98] tracking-[-0.05em] text-ink sm:text-6xl lg:text-[4.25rem]">
              A front desk that answers before the lead goes cold.
            </h1>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-ink/65">
              Teach Nudge with real clinic information, test grounded answers
              across 15 private replies, and then connect the full AI Front
              Desk through a paid setup.
            </p>
            <p className="mt-8 max-w-xl border-t border-ink/10 pt-5 text-sm font-semibold leading-6 text-ink/70">
              7 days · 15 replies · No card required · No live WhatsApp
              connection.
            </p>
          </div>

          <div
            id="start-free-trial"
            className="scroll-mt-20 border-t border-ink/10 py-12 sm:py-16 lg:border-l lg:border-t-0 lg:py-24 lg:pl-14 xl:pl-20"
          >
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-ink">
              Create your private workspace
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink/65">
              Add your details now. You will train and test Nudge after signing
              in.
            </p>
            <div className="mt-7">
              <TrialSignupForm />
            </div>
          </div>
        </Container>
      </section>

      <FreeTrialSections />

      <footer className="border-t border-ink/10 bg-white py-7">
        <Container className="flex flex-col gap-4 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nudge</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-ink hover:underline" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-ink hover:underline" href="/terms">
              Terms
            </Link>
            <a
              className="hover:text-ink hover:underline"
              href="mailto:hqnudge@gmail.com"
            >
              Contact
            </a>
          </nav>
        </Container>
      </footer>
    </main>
  );
}
