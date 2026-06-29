import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Container } from "./section";
import { Logo } from "./logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Platform tour", href: "#showcase" },
      { label: "Workflow", href: "#workflow" },
      { label: "Pricing", href: "#pricing" },
      { label: "Photo → campaign", href: "#photo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Customers", href: "#testimonials" },
      { label: "For sales & support", href: "#teams" },
      { label: "Contact", href: "#get-started" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Sign in", href: "/login" },
      { label: "Join the waitlist", href: "/waitlist" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="bg-linegrid pointer-events-none absolute inset-0 opacity-30" />
      <Container className="relative z-10 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo tone="dark" />
            <p className="mt-4 text-[14.5px] leading-relaxed text-white/55">
              The WhatsApp CRM your whole team runs on — shared inbox, AI replies,
              campaigns and analytics, compliant by default.
            </p>
            <div className="mt-5 flex gap-2.5">
              <a
                href="mailto:hello@nudge.so"
                aria-label="Email Nudge"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Mail className="h-[18px] w-[18px]" />
              </a>
              <a
                href="#get-started"
                aria-label="Chat with us on WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-white/40">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14.5px] text-white/65 transition-colors hover:text-brand-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-[13px] text-white/45">
            © 2026 Nudge — the first product of the Nudge AI studio for Asian SME
            retail.
          </p>
          <p className="flex items-center gap-2 text-[13px] text-white/45">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> All systems
              in simulation
            </span>
            Made in India 🇮🇳
          </p>
        </div>
      </Container>
    </footer>
  );
}
