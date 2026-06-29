"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Inbox,
  KanbanSquare,
  LineChart,
  Megaphone,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { SpotlightCard, Stagger, StaggerItem } from "./motion-primitives";
import { cn } from "@/lib/cn";

function CardShell({
  icon: Icon,
  title,
  desc,
  span,
  highlight,
  children,
  href,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  span: string;
  highlight?: boolean;
  children?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <SpotlightCard
      className={cn(
        "flex h-full flex-col rounded-3xl border p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7",
        highlight
          ? "border-brand-300/70 bg-gradient-to-br from-brand-50 to-white"
          : "border-black/5 bg-white"
      )}
      spotlight={highlight ? "rgba(6,193,103,0.22)" : "rgba(6,193,103,0.14)"}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-grid h-11 w-11 place-items-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110",
            highlight
              ? "bg-brand-500 text-white ring-brand-400"
              : "bg-brand-50 text-brand-600 ring-brand-200/60"
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {highlight && (
          <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">
            Signature feature
          </span>
        )}
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-ink/60">
        {desc}
      </p>

      {children && <div className="mt-6 flex-1">{children}</div>}

      {href && (
        <Link
          href={href}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          See how it works
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </SpotlightCard>
  );

  return (
    <StaggerItem className={cn("col-span-1", span)}>{inner}</StaggerItem>
  );
}

/* ---- small decorative visuals ---- */

function InboxVisual() {
  const rows = [
    { n: "Aarav T.", t: "Assigned to you", hue: "from-amber-400 to-rose-500", you: true },
    { n: "Neha G.", t: "Riya is replying…", hue: "from-brand-400 to-emerald-600" },
    { n: "Studio Décor", t: "Resolved · 2m", hue: "from-sky-400 to-indigo-500" },
  ];
  return (
    <div className="grid gap-2 rounded-2xl border border-black/5 bg-brand-50/40 p-3">
      {rows.map((r) => (
        <div
          key={r.n}
          className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-soft"
        >
          <span
            className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ${r.hue} text-[11px] font-bold text-white`}
          >
            {r.n[0]}
          </span>
          <span className="text-[13px] font-semibold text-ink">{r.n}</span>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
              r.you ? "bg-brand-100 text-brand-700" : "bg-black/5 text-ink/50"
            )}
          >
            {r.t}
          </span>
        </div>
      ))}
    </div>
  );
}

function PipelineVisual() {
  const cols = [
    { k: "New", n: 8, c: "bg-sky-400" },
    { k: "Qualified", n: 5, c: "bg-amber-400" },
    { k: "Won", n: 3, c: "bg-brand-500" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((c) => (
        <div key={c.k} className="rounded-xl border border-black/5 bg-black/[0.02] p-2.5">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c.c}`} />
            <span className="text-[11px] font-semibold text-ink/60">{c.k}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {Array.from({ length: c.n > 2 ? 2 : c.n }).map((_, i) => (
              <div key={i} className="h-3 rounded-md bg-white shadow-soft" />
            ))}
            <p className="text-[11px] font-bold text-ink/40">{c.n} leads</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoVisual() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-16 w-16 shrink-0 rounded-xl bg-[linear-gradient(135deg,#c8a24a,#9c1f3a)] shadow-soft" />
      <ArrowRight className="h-4 w-4 shrink-0 text-brand-500" />
      <div className="flex-1 rounded-xl rounded-tl-sm bg-white p-2.5 shadow-soft ring-1 ring-black/5">
        <div className="h-2 w-3/4 rounded bg-ink/80" />
        <div className="mt-1.5 h-1.5 w-full rounded bg-ink/15" />
        <div className="mt-1 h-1.5 w-5/6 rounded bg-ink/15" />
      </div>
    </div>
  );
}

function BroadcastVisual() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-3">
      <div>
        <p className="text-[11px] text-ink/45">Audience</p>
        <p className="text-base font-bold text-ink">1,284 opted-in</p>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-ink/45">Est. cost</p>
        <p className="text-base font-bold text-brand-600">₹ 899</p>
      </div>
    </div>
  );
}

function AutomationVisual() {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-semibold">
      <span className="rounded-lg bg-white px-2.5 py-1.5 text-ink/70 shadow-soft ring-1 ring-black/5">
        No reply in 24h
      </span>
      <span className="text-brand-500">→</span>
      <span className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-white shadow-soft">
        Send follow-up
      </span>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [42, 64, 38, 80, 56, 72, 90, 60];
  const legend = [
    { k: "Delivered", c: "bg-brand-300" },
    { k: "Read", c: "bg-brand-500" },
    { k: "Clicked", c: "bg-brand-700" },
  ];
  return (
    <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
      <div className="flex h-24 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-500 hover:opacity-80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map((l) => (
          <span key={l.k} className="flex items-center gap-1.5 text-[12px] font-medium text-ink/55">
            <span className={`h-2 w-2 rounded-full ${l.c}`} />
            {l.k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FeaturesBento() {
  return (
    <Section id="features" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="Everything in one platform"
          title={
            <>
              A complete WhatsApp CRM —{" "}
              <span className="text-gradient">not another inbox plugin</span>
            </>
          }
          subtitle="Conversations, leads, campaigns, automations and analytics live together. No tab-hopping, no spreadsheets, no leads slipping through."
        />

        <Stagger className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
          <CardShell
            icon={Inbox}
            title="Shared team inbox"
            desc="Route conversations to the right teammate, leave internal notes, and reply with one source of truth. Presence shows who's typing, live."
            span="md:col-span-2 lg:col-span-4"
          >
            <InboxVisual />
          </CardShell>

          <CardShell
            icon={KanbanSquare}
            title="Leads & pipeline"
            desc="Every chat becomes a tracked lead with stages, owners and value."
            span="lg:col-span-2"
          >
            <PipelineVisual />
          </CardShell>

          <CardShell
            icon={Camera}
            title="Photo → campaign"
            desc="Snap a product photo and Nudge writes a compliant, ready-to-send campaign in seconds."
            span="lg:col-span-2"
            highlight
            href="#photo"
          >
            <PhotoVisual />
          </CardShell>

          <CardShell
            icon={Megaphone}
            title="Broadcasts & templates"
            desc="Send Meta-approved templates to opted-in audiences — with the ₹ cost shown up front."
            span="lg:col-span-2"
          >
            <BroadcastVisual />
          </CardShell>

          <CardShell
            icon={Workflow}
            title="Automations & workflows"
            desc="Trigger follow-ups, tags and replies on any event. Set it once, never chase again."
            span="lg:col-span-2"
          >
            <AutomationVisual />
          </CardShell>

          <CardShell
            icon={LineChart}
            title="Analytics & revenue"
            desc="Track delivered, read and clicked in real time — then tie every campaign back to the revenue it drove and the rupees it cost."
            span="md:col-span-2 lg:col-span-4"
          >
            <AnalyticsVisual />
          </CardShell>

          <CardShell
            icon={ShieldCheck}
            title="Compliance & consent"
            desc="Opt-in tracking and automatic STOP handling keep your number healthy."
            span="lg:col-span-2"
          >
            <div className="flex items-center gap-2 text-[11.5px] font-semibold">
              <span className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-brand-700 ring-1 ring-brand-200/60">
                100% opt-in
              </span>
              <span className="rounded-lg bg-black/5 px-2.5 py-1.5 text-ink/60">
                Auto-STOP
              </span>
            </div>
          </CardShell>
        </Stagger>
      </Container>
    </Section>
  );
}
