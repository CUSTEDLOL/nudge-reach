import { Check, Crown, PhoneCall } from "lucide-react";
import { Container, Section } from "./section";
import { BookDemoButton } from "./book-demo";

/**
 * One package, scoped per business: implementation starts at ₹20,000 and the
 * exact plan is built on a demo call with the founders. No tier grid — the
 * conversation is the pricing page.
 */
const INCLUDED = [
  "Your WhatsApp number on the official Meta Cloud API",
  "AI agent trained on your business — menu, services, hours, FAQs",
  "Real bookings into your calendar, with availability checks",
  "Payment links so deposits are collected before no-shows",
  "Follow-ups that chase quiet leads and remind bookings",
  "Approved message templates, set up and submitted for you",
  "A working front desk before we hand over the keys",
];

export function Pricing() {
  return (
    <Section id="pricing" className="bg-[#f8fbf1]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Simple pricing · One package
          </span>
          <h1 className="mt-6 font-display text-[2.2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3.4rem]">
            One package.
            <br />
            <span className="text-ink/38">Built around you.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink/60">
            Every business runs its WhatsApp differently, so we don&rsquo;t sell
            tiers. We set the whole thing up for you, and the plan is scoped to
            your business on a call.
          </p>
        </div>

        {/* The one card */}
        <article
          className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-9"
          style={{
            background:
              "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
          }}
        >
          {/* ghost word — the theme's giant backdrop */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 right-2 select-none font-display text-[clamp(5rem,12vw,9rem)] font-black uppercase leading-none tracking-[-0.06em] text-white/25"
          >
            Setup
          </span>

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full border-2 border-ink/70 bg-white px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.35)]">
                <Crown className="h-3.5 w-3.5" aria-hidden />
                Done for you · End to end
              </span>
              <h2 className="mt-4 font-display text-[2rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink sm:text-[2.8rem]">
                Implementation package
              </h2>
              <p className="mt-3 max-w-md text-[14.5px] font-medium leading-relaxed text-ink/75">
                We build, train and launch your AI Front Desk — then hand it
                over running. You don&rsquo;t configure anything.
              </p>

              <div className="mt-6">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink/60">
                  Starting from
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="font-display text-[3.4rem] font-black leading-none tracking-[-0.03em] text-ink">
                    ₹20,000
                  </span>
                </div>
                <p className="mt-2 max-w-md text-[13px] font-semibold text-ink/60">
                  Final quote depends on your scope — integrations, languages
                  and volume. No hidden charges.
                </p>
              </div>

              <BookDemoButton className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] px-7 text-[13.5px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]">
                <PhoneCall className="h-4 w-4" aria-hidden />
                Book a Demo
              </BookDemoButton>
              <p className="mt-3 text-[12.5px] font-semibold text-ink/60">
                Talk directly to our executives and get a plan customized to
                your business.
              </p>
            </div>

            <ul className="grid gap-2.5 rounded-2xl border-2 border-ink/25 bg-white/55 p-5 backdrop-blur-sm sm:p-6">
              <li className="mb-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-ink/55">
                What we set up for you
              </li>
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-ink/70 bg-[#ffd94a] text-ink">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                  <span className="text-[13px] font-semibold leading-snug text-ink/80">
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <p className="mx-auto mt-8 max-w-2xl text-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
          Official WhatsApp Cloud API · Meta&rsquo;s per-message charges pass
          through at cost
        </p>
      </Container>
    </Section>
  );
}
