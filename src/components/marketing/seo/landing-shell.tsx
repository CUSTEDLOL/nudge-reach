import type { ReactNode } from "react";
import { Footer } from "@/components/marketing/footer";
import { LaunchDemoButton } from "@/components/marketing/launch-cta";
import { Navbar } from "@/components/marketing/navbar";
import type { BreadcrumbItem } from "@/modules/marketing/structured-data";
import { Breadcrumbs } from "./breadcrumbs";

interface LandingShellProps {
  breadcrumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  ctaTitle?: string;
  ctaBody?: string;
  surface?: string;
}

export function LandingShell({
  breadcrumbs,
  eyebrow,
  title,
  intro,
  children,
  ctaTitle = "See Nudge in action",
  ctaBody = "See how an AI Front Desk can run your clinic's WhatsApp.",
  surface = "unknown",
}: LandingShellProps) {
  return (
    <>
      <Navbar />
      <main className="pt-32">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <Breadcrumbs items={breadcrumbs} />
          <p className="mt-10 font-mono text-sm font-bold uppercase tracking-[0.16em] text-[#06c167]">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-ink sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/70">{intro}</p>
          <div className="mt-12">{children}</div>
          <section className="mt-16 rounded-3xl bg-ink px-8 py-10 text-white sm:px-12">
            <h2 className="text-2xl font-black">{ctaTitle}</h2>
            <p className="mt-3 max-w-2xl text-white/75">{ctaBody}</p>
            <LaunchDemoButton
              surface={surface}
              className="mt-6 inline-flex rounded-xl bg-[#06c167] px-5 py-3 font-bold text-white hover:bg-[#05ac5d]"
            >
              Book a Demo
            </LaunchDemoButton>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
