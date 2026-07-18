import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Container } from "./section";
import { Logo } from "./logo";
import { BookDemoButton } from "./book-demo";

type FooterLink = { label: string; href?: string; demo?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "The comparison", href: "/#compare" },
      { label: "The salary math", href: "/pricing#salary" },
      { label: "The full toolkit", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Book a setup call", demo: true },
      { label: "Contact", href: "mailto:hello@nudge.so" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Start free", href: "/login" },
      { label: "Book a demo", demo: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0b3d2e]">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo tone="dark" />
            <p className="mt-4 text-[14px] leading-relaxed text-white/60">
              The AI Front Desk that runs your WhatsApp: it books, chases and
              collects, and we set the whole thing up. Compliant by default.
            </p>
            <div className="mt-5 flex gap-2.5">
              <a
                href="mailto:hello@nudge.so"
                aria-label="Email Nudge"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-brand-500 hover:text-white"
              >
                <Mail className="h-[18px] w-[18px]" />
              </a>
              <a
                href="#get-started"
                aria-label="Chat with us on WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-brand-500 hover:text-white"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-brand-300/80">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.demo ? (
                      <BookDemoButton className="text-[14px] text-white/60 transition-colors hover:text-white">
                        {link.label}
                      </BookDemoButton>
                    ) : (
                      <Link
                        href={link.href ?? "#"}
                        className="text-[14px] text-white/60 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-[13px] text-white/45">
            © 2026 Nudge, the first product of the Nudge AI studio for Asian
            SME retail.
          </p>
          <p className="flex items-center gap-2 text-[13px] text-white/45">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> All
              systems in simulation
            </span>
            Made in India 🇮🇳
          </p>
        </div>
      </Container>
    </footer>
  );
}
