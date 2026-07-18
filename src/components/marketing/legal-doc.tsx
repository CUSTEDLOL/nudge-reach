import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "./section";
import { Logo } from "./logo";
import { Footer } from "./footer";

export interface LegalSection {
  heading: string;
  /** Paragraphs and/or bullet groups. */
  body: Array<string | { list: string[] }>;
}

/**
 * Shared renderer for the public legal pages (privacy, terms). Plain, readable
 * prose on the cream marketing background — no animations, print-friendly.
 */
export function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="relative z-10 border-b border-black/5">
        <Container className="flex items-center justify-between py-5">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </Container>
      </header>

      <main className="flex-1 py-14 sm:py-20">
        <Container className="max-w-3xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-brand-700">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-ink/45">Last updated {updated}</p>
          <p className="mt-6 text-[15px] leading-relaxed text-ink/70">{intro}</p>

          <div className="mt-10 space-y-10">
            {sections.map((section, i) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold text-ink">
                  {i + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((block, j) =>
                    typeof block === "string" ? (
                      <p
                        key={j}
                        className="text-[14.5px] leading-relaxed text-ink/70"
                      >
                        {block}
                      </p>
                    ) : (
                      <ul
                        key={j}
                        className="list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-ink/70"
                      >
                        {block.list.map((item, k) => (
                          <li key={k}>{item}</li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
            <p className="text-[14.5px] leading-relaxed text-ink/70">
              Questions about this document? Email{" "}
              <a
                href="mailto:hello@nudge.so"
                className="font-semibold text-brand-700 underline-offset-2 hover:underline"
              >
                hello@nudge.so
              </a>
              .
            </p>
          </div>

          <p className="mt-8 text-[13px] leading-relaxed text-ink/40">
            This document uses placeholders in [brackets] for the operating
            legal entity&apos;s registered details. Replace them with your
            registered company name, address and jurisdiction before publishing,
            and have a lawyer review it for your market. This is a strong
            starting draft, not legal advice.
          </p>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
