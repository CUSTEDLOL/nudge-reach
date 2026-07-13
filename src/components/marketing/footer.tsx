import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Container } from "./section";
import { Logo } from "./logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "The comparison", href: "/#compare" },
      { label: "The salary math", href: "/pricing#salary" },
      { label: "Industries", href: "/#industries" },
      { label: "The full toolkit", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "For partners", href: "/#partners" },
      { label: "Book a setup call", href: "/waitlist" },
      { label: "Contact", href: "mailto:hello@nudge.so" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Start free", href: "/login" },
      { label: "Book a demo", href: "/waitlist" },
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
    <footer className="border-t border-emerald-950/[0.06] bg-[#f3faf6]">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-ink/55">
              The AI Front Desk that runs your WhatsApp — it books, chases and
              collects, and we set the whole thing up. Compliant by default.
            </p>
            <div className="mt-5 flex gap-2.5">
              <a
                href="mailto:hello@nudge.so"
                aria-label="Email Nudge"
                className="grid h-10 w-10 place-items-center rounded-xl border border-black/[0.07] bg-white text-ink/60 transition-colors hover:text-ink"
              >
                <Mail className="h-[18px] w-[18px]" />
              </a>
              <a
                href="#get-started"
                aria-label="Chat with us on WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-xl border border-black/[0.07] bg-white text-ink/60 transition-colors hover:text-ink"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-ink/40">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-ink/60 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-black/[0.06] pt-8 sm:flex-row">
          <p className="text-[13px] text-ink/45">
            © 2026 Nudge — the first product of the Nudge AI studio for Asian
            SME retail.
          </p>
          <p className="flex items-center gap-2 text-[13px] text-ink/45">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> All
              systems in simulation
            </span>
            Made in India 🇮🇳
          </p>
        </div>
      </Container>
    </footer>
  );
}
