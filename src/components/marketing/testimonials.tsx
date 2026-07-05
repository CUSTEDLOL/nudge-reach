"use client";

import { ShieldCheck, Star } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Marquee, Reveal } from "./motion-primitives";
import { cn } from "@/lib/cn";

type Quote = {
  body: string;
  name: string;
  role: string;
  hue: string;
};

const QUOTES: Quote[] = [
  { body: "We replied to 200 Diwali enquiries in a day — without hiring. The AI drafts are scary good.", name: "Meera Shah", role: "Owner · Meera Sarees, Jaipur", hue: "from-amber-400 to-rose-500" },
  { body: "Our cart-abandon follow-ups alone paid for the year. Setup took one afternoon.", name: "Rahul Verma", role: "Founder · ChaiCraft, Pune", hue: "from-brand-400 to-emerald-600" },
  { body: "Sales and support finally see the same chat. No more 'who replied to this?'", name: "Ananya Rao", role: "Ops Lead · Studio Décor, Bengaluru", hue: "from-sky-400 to-indigo-500" },
  { body: "From product photo to a sent campaign in under a minute. My team thinks I hired an agency.", name: "Imran Khan", role: "Khan Electronics, Hyderabad", hue: "from-fuchsia-400 to-purple-600" },
  { body: "Open rates we never got on email — 90%+ reads on every broadcast.", name: "Priya Nair", role: "Marketing · Bloom & Co, Kochi", hue: "from-teal-400 to-emerald-600" },
  { body: "The ₹ cost preview before every send means zero nasty surprises. Love it.", name: "Vikram Singh", role: "Singh Jewellers, Amritsar", hue: "from-orange-400 to-red-500" },
  { body: "Opt-in handling is automatic, so I sleep easy about WhatsApp's rules.", name: "Sara Thomas", role: "Founder · Knot & Co, Goa", hue: "from-pink-400 to-rose-600" },
  { body: "It feels like one calm screen, even when 50 chats land at once.", name: "Dev Patel", role: "Patel Bakers, Ahmedabad", hue: "from-lime-400 to-brand-600" },
];

const BADGES = [
  "Official WhatsApp Cloud API",
  "Meta policy-compliant",
  "Opt-in & consent first",
  "Your data, your control",
  "Works in simulation first",
];

function Card({ q }: { q: Quote }) {
  return (
    <figure className="mx-2 flex w-[330px] shrink-0 flex-col justify-between rounded-3xl border border-black/5 bg-white p-6 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:w-[360px]">
      <div>
        <div className="flex items-center gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-current" />
          ))}
        </div>
        <blockquote className="mt-4 text-[15.5px] leading-relaxed text-ink/75">
          “{q.body}”
        </blockquote>
      </div>
      <figcaption className="mt-6 flex items-center gap-3">
        <span
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
            q.hue
          )}
        >
          {q.name[0]}
        </span>
        <div>
          <p className="text-[14px] font-semibold text-ink">{q.name}</p>
          <p className="text-[12.5px] text-ink/50">{q.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  const half = Math.ceil(QUOTES.length / 2);
  const rowA = QUOTES.slice(0, half);
  const rowB = QUOTES.slice(half);

  return (
    <Section id="testimonials" className="overflow-hidden bg-cream">
      <Container>
        <SectionHeading
          eyebrow="Loved by busy shop floors"
          title={
            <>
              Shopkeepers and D2C founders{" "}
              <span className="text-gradient">who stopped dropping leads</span>
            </>
          }
          subtitle="Illustrative of the teams Nudge is built for — from a single-counter saree shop to a multi-city D2C brand."
        />
      </Container>

      <div className="mt-14 flex flex-col gap-5">
        <Marquee speed={55} gap="0.5rem">
          {rowA.map((q) => (
            <Card key={q.name} q={q} />
          ))}
        </Marquee>
        <Marquee speed={65} gap="0.5rem" reverse>
          {rowB.map((q) => (
            <Card key={q.name} q={q} />
          ))}
        </Marquee>
      </div>

      <Container>
        <Reveal delay={0.1} className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {BADGES.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-[13px] font-semibold text-ink/70 shadow-soft"
            >
              <ShieldCheck className="h-4 w-4 text-brand-500" />
              {b}
            </span>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}
