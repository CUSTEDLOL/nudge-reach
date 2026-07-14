import {
  Building2,
  Check,
  Dumbbell,
  Factory,
  GraduationCap,
  HeartPulse,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Container, Section } from "./section";
import { Reveal, Stagger, StaggerItem } from "./motion-primitives";

type Industry = {
  icon: LucideIcon;
  title: string;
  outcome: string;
  body: string;
  /** Gradient endpoints (6-digit hex) — used for the hover bloom, halo and chip. */
  from: string;
  to: string;
  chat: { inbound: string; reply: string; status: string };
};

const INDUSTRIES: Industry[] = [
  {
    icon: HeartPulse,
    title: "Clinics, salons & spas",
    outcome: "fewer no-shows, fuller chairs",
    body: "Appointments confirmed automatically, reminders the evening before, a rebooking nudge weeks later.",
    from: "#f43f5e",
    to: "#ec4899",
    chat: {
      inbound: "Any slot tomorrow evening?",
      reply: "4:30 PM with Priya is open — booked you in ✓",
      status: "Reminder scheduled · 9 AM",
    },
  },
  {
    icon: GraduationCap,
    title: "Education & coaching",
    outcome: "fuller batches",
    body: "Admission enquiries answered before parents call the next institute. Fee reminders and demo follow-ups, on time.",
    from: "#8b5cf6",
    to: "#6366f1",
    chat: {
      inbound: "What are the fees for the NEET batch?",
      reply: "₹45,000/year — free demo class Sat 11 AM. Reserve a seat?",
      status: "Demo class booked",
    },
  },
  {
    icon: Building2,
    title: "Real estate",
    outcome: "warmer leads",
    body: "Portal enquiries answered in seconds, site-visit details on time, follow-ups through weeks of deciding.",
    from: "#0ea5e9",
    to: "#06b6d4",
    chat: {
      inbound: "Is the 2BHK in Andheri still available?",
      reply: "Yes — site visit this Sunday 11 AM? I'll send the location.",
      status: "Site visit scheduled",
    },
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants & cafés",
    outcome: "fuller tables",
    body: "Reservations, pre-orders and feedback follow-ups handled while the kitchen runs at full tilt.",
    from: "#f97316",
    to: "#ef4444",
    chat: {
      inbound: "Table for 4 tonight?",
      reply: "8 PM by the window — reserved for you 🎉",
      status: "Reservation confirmed",
    },
  },
  {
    icon: ShoppingBag,
    title: "Ecommerce & D2C",
    outcome: "recovered orders",
    body: "Abandoned-cart nudges, COD confirmations and delivery updates — sales email would have lost.",
    from: "#f59e0b",
    to: "#fb923c",
    chat: {
      inbound: "Is COD available on my order?",
      reply: "Yes — order confirmed for COD ✓ Arriving Thursday.",
      status: "COD confirmed",
    },
  },
  {
    icon: Wrench,
    title: "Local services",
    outcome: "repeat bookings",
    body: "Quotes, confirmations and “reaching in 20 minutes” updates — big-brand polish from a two-person team.",
    from: "#14b8a6",
    to: "#10b981",
    chat: {
      inbound: "How much for AC servicing?",
      reply: "₹599 — technician free tomorrow 10 AM. Book it?",
      status: "Job scheduled",
    },
  },
  {
    icon: Factory,
    title: "Manufacturing & B2B",
    outcome: "faster quotes",
    body: "Dealer and bulk enquiries get specs, prices and dispatch timelines before your competitor picks up the phone.",
    from: "#6366f1",
    to: "#3b82f6",
    chat: {
      inbound: "Need 500 units — best rate?",
      reply: "₹118/unit, dispatch in 12 days. Quote PDF sent 📄",
      status: "Quote sent in 40 seconds",
    },
  },
  {
    icon: Dumbbell,
    title: "Gyms & fitness",
    outcome: "renewals on time",
    body: "Trial follow-ups, class reminders and membership renewals chased — without the front-desk chase.",
    from: "#84cc16",
    to: "#22c55e",
    chat: {
      inbound: "Can I get a trial session?",
      reply: "Tomorrow 7 AM strength class — you're in 💪",
      status: "Trial booked",
    },
  },
  {
    icon: Store,
    title: "…and yours",
    outcome: "if they message you, it fits",
    body: "Travel, boutiques, repair shops, agencies — if customers message you on WhatsApp, the Front Desk runs it.",
    from: "#06c167",
    to: "#37ce86",
    chat: {
      inbound: "Hi! Quick question…",
      reply: "Answered — in seconds, at 2 AM, every time.",
      status: "That's the point",
    },
  },
];

/** One industry card: a live WhatsApp micro-scene up top (customer message +
 * typing dots) that resolves on hover — the typing indicator becomes the Front
 * Desk's reply, a status chip lands, and the industry's gradient blooms in. */
function IndustryCard({ item }: { item: Industry }) {
  const { icon: Icon, title, outcome, body, from, to, chat } = item;
  return (
    <div
      className="group relative h-full transition-transform duration-300 ease-out hover:-translate-y-1"
      style={{ "--c1": from } as CSSProperties}
    >
      {/* gradient halo that peeks past the card edge on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 rounded-[18px] opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-35"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      />
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-[#f4f6f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-shadow duration-300 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_48px_-20px_rgba(10,31,26,0.25)]">
        {/* ---- chat micro-scene ---- */}
        <div className="relative flex min-h-[176px] flex-col gap-2 px-5 pb-4 pt-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `linear-gradient(150deg, ${from}26, ${to}14 55%, transparent 82%)`,
            }}
          />
          {/* customer message */}
          <div className="relative max-w-[88%] self-start rounded-xl rounded-bl-[4px] bg-white px-3 py-2 text-[12px] leading-snug text-ink/80 shadow-sm ring-1 ring-black/[0.04]">
            {chat.inbound}
          </div>
          {/* typing indicator ⇄ reply, stacked in one grid cell so the card
              never changes height when they swap */}
          <div className="relative grid justify-items-end">
            <div className="flex items-center gap-1 self-start rounded-xl rounded-br-[4px] bg-brand-100/80 px-3 py-2.5 shadow-sm transition-all duration-200 [grid-area:1/1] group-hover:scale-90 group-hover:opacity-0 motion-reduce:hidden">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-800/40"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            <div className="max-w-[88%] translate-y-2 rounded-xl rounded-br-[4px] bg-brand-100 px-3 py-2 text-[12px] leading-snug text-brand-950/85 opacity-0 shadow-sm transition-all duration-300 [grid-area:1/1] group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-150 motion-reduce:translate-y-0 motion-reduce:opacity-100">
              {chat.reply}
            </div>
          </div>
          {/* outcome chip, WhatsApp-system-message style */}
          <div className="mt-auto flex translate-y-1.5 items-center gap-1.5 self-center rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-semibold text-ink/60 opacity-0 shadow-sm ring-1 ring-black/[0.04] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-300 motion-reduce:translate-y-0 motion-reduce:opacity-100">
            <Check className="h-3 w-3 text-brand-600" aria-hidden />
            {chat.status}
          </div>
        </div>

        {/* ---- text ---- */}
        <div className="flex flex-1 flex-col border-t border-black/[0.04] px-5 pb-6 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04]">
              <span
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
              />
              <Icon
                className="relative h-4 w-4 text-[color:var(--c1)] transition-colors duration-300 group-hover:text-white"
                aria-hidden
              />
            </span>
            <h3 className="text-[15.5px] font-bold text-ink">{title}</h3>
          </div>
          <p className="serif-display mt-2.5 text-[14px] text-ink/50">
            {outcome}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/55">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Industries() {
  return (
    <Section id="industries" className="bg-white">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            If the phone rings all day,
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Nudge fits.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            From a two-chair salon in Indore to a factory floor in Ludhiana —
            if your customers message you, it fits the way you already work.
            Hover any card to watch the Front Desk reply.
          </p>
        </Reveal>

        <Stagger className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((item) => (
            <StaggerItem key={item.title} className="h-full">
              <IndustryCard item={item} />
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
