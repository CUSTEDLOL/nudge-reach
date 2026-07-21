import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Mail,
  MessageCircle,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import { Container } from "./section";
import { Logo } from "./logo";
import { LaunchDemoButton } from "./launch-cta";
import { HoloCard } from "./holo-card";

type FooterLink = {
  label: string;
  href?: string;
  demo?: boolean;
  external?: boolean;
};

const LINK_GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Compare", href: "/#compare" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Start",
    links: [
      { label: "Book a demo", demo: true },
      { label: "Start free", href: "/login" },
      { label: "Contact", href: "mailto:hqnudge@gmail.com" },
    ],
  },
  {
    title: "Founders",
    links: [
      {
        label: "Vishesh Jain",
        href: "https://www.linkedin.com/in/visheshvjain/",
        external: true,
      },
      {
        label: "Dhairya Kakkar",
        href: "https://www.linkedin.com/in/dhairyakakkar/",
        external: true,
      },
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

const MOVES = [
  { label: "Books into your real calendar", icon: CalendarCheck },
  { label: "Chases every quiet lead", icon: Repeat },
  { label: "Collects deposits before no-shows", icon: CreditCard },
];

function FooterTextLink({ link }: { link: FooterLink }) {
  const linkClass =
    "group/link inline-flex items-center gap-1 text-[15px] font-semibold text-ink/65 transition-colors hover:text-ink";
  const arrow = (
    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover/link:translate-x-0.5 group-hover/link:opacity-100" />
  );

  if (link.demo) {
    return (
      <LaunchDemoButton className={linkClass}>
        {link.label}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
      </LaunchDemoButton>
    );
  }

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {link.label}
        {arrow}
      </a>
    );
  }

  return (
    <Link href={link.href ?? "#"} className={linkClass}>
      {link.label}
      {arrow}
    </Link>
  );
}

/** The real park ground — a seamless mirror-tiled crop of the hero's pixel
 * lawn-into-clover band, not CSS blades. */
function GrassEdge() {
  return (
    <div
      aria-hidden
      className="h-24 w-full sm:h-28"
      style={{
        backgroundImage: "url(/hero/grass-edge.png)",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: "bottom center",
      }}
    />
  );
}

export function Footer() {
  return (
    <footer
      id="site-footer"
      className="relative overflow-hidden border-t-2 border-ink/10 bg-[#f8fbf1]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,15,13,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(10,15,13,0.045)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white to-transparent"
      />

      <Container className="relative py-16 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,25rem)] lg:gap-16">
          <div>
            <Logo tone="light" />
            <h2 className="mt-10 font-display text-[clamp(1.7rem,4.4vw,4.1rem)] font-black uppercase leading-[0.98] text-ink">
              <span className="block whitespace-nowrap">Your best front desk</span>
              <span className="block whitespace-nowrap text-ink/38">
                inside WhatsApp
              </span>
            </h2>

            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {MOVES.map((move) => {
                const Icon = move.icon;
                return (
                  <div
                    key={move.label}
                    className="flex items-center gap-3 rounded-2xl border-2 border-ink/70 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(10,15,13,0.82)]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-ink/70 bg-[#ffd94a] text-ink">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-[13px] font-black leading-tight text-ink">
                      {move.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
              {LINK_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-ink/42">
                    {group.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <FooterTextLink link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href="mailto:hqnudge@gmail.com"
                aria-label="Email Nudge"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink/70 bg-white text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)] transition-all hover:-translate-y-0.5 hover:bg-[#ffd94a]"
              >
                <Mail className="h-[18px] w-[18px]" />
              </a>
              <LaunchDemoButton
                aria-label="Book a demo call"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink/70 bg-white text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)] transition-all hover:-translate-y-0.5 hover:bg-[#06c167] hover:text-white"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </LaunchDemoButton>
              <span className="inline-flex items-center gap-2 rounded-xl border-2 border-ink/70 bg-[#e9f7ff] px-4 py-2.5 text-[12.5px] font-black text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)]">
                <ShieldCheck className="h-4 w-4" />
                Official Meta Cloud API only
              </span>
            </div>
          </div>

          <HoloCard />
        </div>
      </Container>

      <div className="relative">
        <GrassEdge />
        <Container className="pointer-events-none absolute inset-0 flex flex-col justify-end pb-4 sm:pb-5">
          <div className="flex flex-col justify-between gap-1 text-[13px] font-semibold text-white [text-shadow:0_1px_4px_rgba(6,20,12,0.55)] sm:flex-row">
            <p>Copyright 2026 Nudge. AI Front Desk for WhatsApp-first businesses.</p>
            <p>Built for opted-in, compliant customer conversations.</p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
