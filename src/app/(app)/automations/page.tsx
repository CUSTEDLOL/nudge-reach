import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import {
  TRIGGER_LABELS,
  type AutomationTrigger,
} from "@/modules/automation/definitions";
import {
  AI_FRONT_DESK_PLAN,
  planHasAiFrontDesk,
} from "@/modules/billing/limits";
import { getFollowUpConfig, getPackTemplateIds } from "@/modules/followup/install";
import { FOLLOW_UP_KINDS, normalizeTiming } from "@/modules/followup/pack";
import { followUpSpecSchema } from "@/modules/followup/spec";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FollowUpBar } from "./follow-up-bar";
import { FollowUpCard, type FollowUpCardModel } from "./follow-up-card";
import { FollowUpRows, type FollowUpRow } from "./follow-up-rows";
import { ResumeFollowUps } from "./resume-follow-ups";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const { org, role } = await requireOrgContext();
  // Managing an automation (switch, edit, delete, builder) is ADMIN, as it has
  // always been; the AI bar needs the flagship, because every action behind it
  // is flagship-gated server-side.
  const canManage = hasRole(role, "ADMIN");
  const hasFrontDesk = planHasAiFrontDesk(org.plan);

  const [config, packTemplates, automations] = await Promise.all([
    getFollowUpConfig(org.id),
    getPackTemplateIds(org.id),
    prisma.automation.findMany({
      where: { orgId: org.id },
      // Creation order only: everything the AI writes lands off, and sorting
      // enabled-first would drop a brand-new follow-up below the fold.
      orderBy: { createdAt: "asc" },
      include: { steps: { orderBy: { order: "asc" } } },
    }),
  ]);

  const templateIdOf = (stepConfig: unknown) =>
    String((stepConfig as { templateId?: string })?.templateId ?? "");

  // One lookup for every template these follow-ups send, so a card can say
  // whether Meta has approved the wording yet.
  const templateIds = automations
    .flatMap((a) =>
      a.steps.filter((s) => s.kind === "send_template").map((s) => templateIdOf(s.config))
    )
    .filter(Boolean);
  const templates = templateIds.length
    ? await prisma.template.findMany({
        where: { orgId: org.id, id: { in: templateIds } },
        select: { id: true, name: true, metaStatus: true },
      })
    : [];
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const cards: FollowUpCardModel[] = automations.map((a) => {
    const spec = followUpSpecSchema.safeParse(a.spec);
    return {
      id: a.id,
      name: a.name,
      spec: spec.success ? spec.data : null,
      source: a.source,
      enabled: a.enabled,
      triggerLabel: TRIGGER_LABELS[a.trigger as AutomationTrigger] ?? a.trigger,
      stepsCount: a.steps.length,
      templates: a.steps
        .filter((s) => s.kind === "send_template")
        .map((s) => {
          const id = templateIdOf(s.config);
          const t = templateById.get(id);
          return {
            id: t ? t.id : "",
            name: t?.name ?? "Message",
            status: t?.metaStatus ?? "PENDING",
          };
        }),
    };
  });

  // The tick-driven follow-ups: they hang off a booking, not off a spec, so
  // they keep their own rows and hour fields.
  const timing = normalizeTiming(config ?? {});
  const tickRows: FollowUpRow[] = config
    ? FOLLOW_UP_KINDS.map((kind) => ({
        flag: kind.flag,
        label: kind.label,
        timing: kind.timing,
        description: kind.description,
        enabled: config[kind.flag],
        timingFields: [...kind.timingFields],
        templates: kind.templateNames.flatMap((name) => {
          const row = packTemplates.get(name);
          return row ? [{ id: row.id, name, status: row.metaStatus }] : [];
        }),
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Nudge chases every quiet lead, reminds every booking and asks for every review — you describe it, the AI writes it, you switch it on."
        actions={
          canManage && (
            <Link
              href="/automations/new"
              className={buttonVariants({ variant: "secondary" })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Build one by hand
            </Link>
          )
        }
      />

      <FollowUpBar
        canManage={canManage}
        hasFrontDesk={hasFrontDesk}
        planName={AI_FRONT_DESK_PLAN.name}
        hasSpecFollowUps={cards.some((c) => c.spec !== null)}
      />

      {/* Only the quiet chase's first message and the chained waits go through
          the daily tick; contact_created, booking_created, keyword and
          campaign_reply all fire inline from matchAutomations. */}
      <p className="mt-3 text-xs text-neutral-500">
        The first message usually goes out straight away. A message set for
        &ldquo;N days later&rdquo; goes out on the next daily run after that
        time — once every 24 hours. A lead you&rsquo;ve handed to a teammate
        isn&rsquo;t chased until the conversation is back to open.
      </p>

      <section className="mt-6 space-y-3">
        {/* A pause clears no per-row flag, so the rows below still read On —
            there is nothing to "switch back on". The button is the way out. */}
        {config && !config.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>Your follow-ups are paused.</span>
            {canManage && hasFrontDesk && <ResumeFollowUps />}
          </div>
        )}
        {tickRows.length > 0 && (
          <FollowUpRows
            rows={tickRows}
            timing={timing}
            canManage={canManage && hasFrontDesk}
            paused={!config?.enabled}
          />
        )}
        {cards.map((c) => (
          <FollowUpCard key={c.id} model={c} canManage={canManage} />
        ))}
        {cards.length === 0 && tickRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            {!canManage
              ? "No follow-ups yet. An admin can set them up."
              : hasFrontDesk
                ? "Nothing yet. Describe one above, or let the AI write your starter set."
                : "Nothing yet. Build your first one by hand — or upgrade to have the AI write them for you."}
          </p>
        )}
      </section>
    </>
  );
}
