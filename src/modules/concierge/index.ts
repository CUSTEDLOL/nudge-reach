import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import type { CampaignContent } from "@/modules/campaign/schema";
import { dedupeKey, splitLegacyLines } from "@/modules/agent/migrate-profile";
import { ruleLimitFor } from "@/modules/agent/rules-store";
import {
  MAX_INSTRUCTION_LENGTH,
  MAX_RULE_TEXT_LENGTH,
  ruleSchema,
  widensScope,
} from "@/modules/agent/rules";
import { storeKnowledgeFacts } from "@/modules/knowledge/store";
import type { DistilledFact } from "@/modules/knowledge/distill";
import type { KnowledgeCategory } from "@/modules/knowledge/digest";

/**
 * Concierge onboarding (5.3): the done-for-you moat. An operator sets a client
 * up in one pass — knowledge base → agent grounding, a starter template
 * pack, and a go-live gate. Everything composes existing pieces (the library
 * template pipeline, the follow-up pack).
 *
 * What "sets the agent up" means changed in `ecb9440`. It used to be: write
 * the KB into `AgentProfile.businessInfo` and the boundaries into `doNots`,
 * and the prompt builder read those columns. No builder reads them now
 * (`fe85add`, `ce1629e`, `360047c`), so writing them alone would have left the
 * client's agent knowing nothing. `installClientGrounding` is the real path —
 * `KnowledgeEntry` facts and `never` `AgentRule` rows. The profile columns are
 * still written, as the operator's untouched original for the form to read
 * back; they are not what grounds the agent.
 */

export interface KnowledgeBaseInput {
  hours?: string;
  location?: string;
  services?: string;
  prices?: string;
  policies?: string;
  faqs?: string;
}

/**
 * Flatten the KB into `AgentProfile.businessInfo`.
 *
 * **No prompt builder reads that column any more** (fe85add, ce1629e,
 * 360047c): the agent is grounded in active `KnowledgeEntry` rows and
 * `AgentRule` rows, which is what `installClientGrounding` writes. This string
 * is now only the operator's editable original — it is what the concierge form
 * shows back, and the untouched source a bad line can be redone from. Writing
 * it is not training the agent; do not treat a non-empty `businessInfo` as
 * evidence that the agent knows anything.
 */
export function buildBusinessInfo(input: KnowledgeBaseInput): string {
  const section = (label: string, value?: string) =>
    value && value.trim() ? `${label}:\n${value.trim()}` : null;
  return [
    section("HOURS", input.hours),
    section("LOCATION", input.location),
    section("SERVICES", input.services),
    section("PRICES", input.prices),
    section("BOOKING & POLICIES", input.policies),
    section("FAQs", input.faqs),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Which knowledge category each concierge field belongs to. The digest groups
 * facts under these headings, so a price filed as `other` reaches the model
 * under "OTHER" instead of "PRICING" — the mapping is what makes the structured
 * form worth filling in rather than one long blob.
 */
const KB_FIELD_CATEGORIES: ReadonlyArray<
  readonly [keyof KnowledgeBaseInput, KnowledgeCategory]
> = [
  ["hours", "hours"],
  ["location", "location"],
  ["services", "menu_services"],
  ["prices", "pricing"],
  ["policies", "policies"],
  ["faqs", "faq"],
] as const;

/** `factSchema`'s own ceiling; the legacy column keeps the untruncated text. */
const MAX_FACT_LENGTH = 300;

/**
 * The six structured fields as the facts the agent actually reads — one per
 * line, split exactly the way `migrateProfileToRules` splits a legacy textarea
 * (bullets, newlines, sentences), so a client set up by concierge and one
 * migrated from the retired Setup page end up with the same shaped rows.
 */
export function conciergeFacts(input: KnowledgeBaseInput): DistilledFact[] {
  const facts: DistilledFact[] = [];
  for (const [field, category] of KB_FIELD_CATEGORIES) {
    for (const line of splitLegacyLines(input[field] ?? "")) {
      facts.push({ category, fact: line.slice(0, MAX_FACT_LENGTH) });
    }
  }
  return facts;
}

export interface ClientGroundingResult {
  /** Active knowledge facts created by this run. 0 on a re-run — they dedupe. */
  facts: number;
  /** Active `never` rules created by this run. 0 on a re-run — they dedupe. */
  rules: number;
  /**
   * do-not lines a guard turned back: scope-widening (invariant #7), longer
   * than a rule may be, or past the org's active-rule cap. They are not lost —
   * `doNots` still holds every line verbatim and the form shows it back — but
   * the agent is not following them, so the caller says so.
   */
  rulesRejected: number;
}

/**
 * Ground the client's agent in the vocabulary it actually reads.
 *
 * The concierge form's six fields used to be flattened into
 * `AgentProfile.businessInfo` and its do-nots into `AgentProfile.doNots`, and
 * that was the whole of "agent trained". Since fe85add/ce1629e/360047c no
 * prompt builder reads either column, so a freshly onboarded client's agent was
 * grounded on nothing at all. This writes the real thing: active
 * `KnowledgeEntry` facts and active `never` `AgentRule` rows.
 *
 * The facts are `active`, not `draft`: concierge content is typed by our own
 * staff off a client call, and a draft reaches no prompt until a human approves
 * it — which is the same silence this function exists to end. (The lazy
 * migration behind /agent files ITS facts as drafts because those are the
 * owner's own unreviewed words.)
 *
 * Idempotent: `storeKnowledgeFacts` dedupes on normalised fact text against
 * every row the org has, and the rules dedupe the same way the migration does.
 * Running client setup twice creates nothing the first run created. (A fact the
 * owner has since archived is not resurrected either — the dedupe sees it.)
 */
export async function installClientGrounding(
  orgId: string,
  input: KnowledgeBaseInput,
  doNots: string
): Promise<ClientGroundingResult> {
  const facts = conciergeFacts(input);
  const stored = facts.length
    ? await storeKnowledgeFacts(orgId, facts, {
        source: "concierge",
        status: "active",
      })
    : { created: 0 };
  return { facts: stored.created, ...(await installDoNotRules(orgId, doNots)) };
}

/**
 * The do-nots box, one `never` rule per line. It applies the two guards
 * `migrateProfileToRules` applies — `widensScope` (invariant #7) and the org's
 * active-rule cap — because concierge staff type into the same box an owner
 * does, and a writer that bypassed them would be a hole in both.
 *
 * `source: "concierge"` is the value `prisma/schema.prisma` already reserves,
 * so the Training page can tell a rule we wrote from one the owner did.
 */
async function installDoNotRules(
  orgId: string,
  doNots: string
): Promise<{ rules: number; rulesRejected: number }> {
  const lines = splitLegacyLines(doNots);
  if (!lines.length) return { rules: 0, rulesRejected: 0 };

  // One read: what this org already has (for the dedupe), how many slots are
  // left, and where `order` continues. Unbounded, but this runs once per client
  // setup from a staff form — not on a page load.
  const existing = await prisma.agentRule.findMany({
    where: { orgId },
    select: { text: true, status: true, order: true },
  });
  const limit = await ruleLimitFor(orgId);
  let slots = Math.max(
    0,
    limit - existing.filter((rule) => rule.status === "active").length
  );
  let order = existing.reduce((max, rule) => Math.max(max, rule.order), -1) + 1;
  const seen = new Set(existing.map((rule) => dedupeKey(rule.text)));

  const rows: Prisma.AgentRuleCreateManyInput[] = [];
  let rulesRejected = 0;
  for (const line of lines) {
    // A line this org already carries is not a second rule, whoever wrote it.
    if (seen.has(dedupeKey(line))) continue;
    if (widensScope(line) || line.length > MAX_RULE_TEXT_LENGTH || slots === 0) {
      rulesRejected += 1;
      continue;
    }
    const parsed = ruleSchema.safeParse({
      text: line,
      // The migration's choice, for the same reason: these lines are already
      // one sentence, and a model call per line would be a slow metered no-op.
      instruction: line.slice(0, MAX_INSTRUCTION_LENGTH),
      scope: "never",
    });
    if (!parsed.success) {
      rulesRejected += 1;
      continue;
    }
    seen.add(dedupeKey(line));
    slots -= 1;
    rows.push({
      orgId,
      text: parsed.data.text,
      instruction: parsed.data.instruction,
      scope: "never",
      condition: null,
      status: "active",
      source: "concierge",
      order: order++,
    });
  }
  if (rows.length) await prisma.agentRule.createMany({ data: rows });
  return { rules: rows.length, rulesRejected };
}

interface VerticalTemplate {
  name: string;
  category: "MARKETING" | "UTILITY";
  content: CampaignContent;
}

const OPT_OUT = "Reply STOP to unsubscribe";

function marketing(
  name: string,
  header: string,
  body: string
): VerticalTemplate {
  return {
    name,
    category: "MARKETING",
    content: {
      productName: name,
      campaignAngle: "Concierge starter pack.",
      header,
      body,
      footer: OPT_OUT,
      buttons: [{ type: "QUICK_REPLY", text: "I'm interested" }],
      sampleName: "Priya",
      imageTreatment: "",
      notes: "Installed by concierge onboarding.",
    },
  };
}

/**
 * The concierge's starter marketing templates — worded for any business, so
 * no client is ever sent another industry's copy.
 */
export const STARTER_PACK: VerticalTemplate[] = [
  marketing(
    "check_in_invite",
    "Can we help?",
    "Hi {{1}}, just checking in — if there's anything you need from us, reply here and we'll take care of it quickly."
  ),
  marketing(
    "come_back_invite",
    "It's been a while",
    "Hi {{1}}, it's been a while! Reply here to see what's new with us — we'd love to help you again."
  ),
];

/** Create the starter marketing templates (approved in simulation so the
 *  demo works; pending in live). Idempotent by (orgId, name). */
export async function installStarterPack(orgId: string): Promise<number> {
  const pack = STARTER_PACK;
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of pack) {
    // Meta takes the components array; name/language/category travel beside it.
    const componentsJson = buildTemplatePayload(t.content, { name: t.name })
      .components as Prisma.InputJsonValue;
    const data = {
      language: "en",
      category: t.category,
      content: t.content as unknown as Prisma.InputJsonValue,
      componentsJson,
      metaStatus: approve ? ("APPROVED" as const) : ("PENDING" as const),
      metaTemplateId: approve ? `sim-tpl-${t.name}` : null,
    };
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({
          data: { orgId, campaignId: null, name: t.name, ...data },
        });
    if (!approve && row.metaStatus !== "APPROVED") {
      await submitRowToMeta(orgId, row).catch((err: unknown) =>
        prisma.template.update({
          where: { id: row.id },
          data: {
            metaStatus: "REJECTED",
            rejectionReason:
              err instanceof Error ? err.message : "Couldn't submit to Meta.",
          },
        })
      );
    }
  }
  return pack.length;
}

export interface ConciergeStatus {
  whatsappConnected: boolean;
  agentConfigured: boolean;
  agentEnabled: boolean;
  calendarConnected: boolean;
  approvedTemplates: number;
  followUpEnabled: boolean;
  ready: boolean;
}

/** The client go-live gate — computed from REAL state (mirrors the WhatsApp
 *  go-live checklist), not stored flags. */
export async function getConciergeStatus(orgId: string): Promise<ConciergeStatus> {
  const [
    profile,
    calendar,
    approvedTemplates,
    followUp,
    knowledgeCount,
    ruleCount,
    whatsappCount,
  ] = await Promise.all([
    prisma.agentProfile.findUnique({ where: { orgId } }),
    prisma.calendarAccount.findUnique({ where: { orgId } }),
    prisma.template.count({
      where: { orgId, campaignId: null, metaStatus: "APPROVED" },
    }),
    prisma.followUpConfig.findUnique({ where: { orgId } }),
    prisma.knowledgeEntry.count({ where: { orgId, status: "active" } }),
    prisma.agentRule.count({ where: { orgId, status: "active" } }),
    prisma.whatsappAccount.count({
      where: { orgId, status: "connected" },
    }),
  ]);
  // Only what the prompt actually carries counts as a configured agent: active
  // knowledge facts, or active house rules. `businessInfo` used to count here,
  // and since fe85add no prompt builder reads that column — so the tick went
  // green for an agent whose prompt said "(No details provided yet.)". Drafts
  // are excluded on purpose: a draft fact reaches no prompt until approved.
  const agentConfigured = knowledgeCount > 0 || ruleCount > 0;
  const agentEnabled = Boolean(profile?.enabled);
  const calendarConnected = Boolean(calendar);
  const followUpEnabled = Boolean(followUp?.enabled);
  const whatsappConnected = whatsappCount > 0;
  return {
    whatsappConnected,
    agentConfigured,
    agentEnabled,
    calendarConnected,
    approvedTemplates,
    followUpEnabled,
    ready:
      whatsappConnected &&
      agentConfigured &&
      agentEnabled &&
      calendarConnected &&
      approvedTemplates > 0 &&
      followUpEnabled,
  };
}
