import { requireFounder } from "@/modules/admin/auth";
import { CONCIERGE_VERTICALS, frontDeskOverview } from "@/modules/admin/concierge";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import { setAgentEnabledAction, setFollowUpsEnabledAction, setupClientAction } from "../actions";

const VERTICAL_LABEL: Record<string, string> = { clinic: "Clinic / Health", salon: "Salon / Beauty" };
const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";

function Field({ label, name, rows = 2, placeholder, defaultValue }: { label: string; name: string; rows?: number; placeholder?: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <textarea name={name} rows={rows} placeholder={placeholder} defaultValue={defaultValue} className={`mt-1 ${inputCls}`} />
    </label>
  );
}

const TEMPLATE_TONE = { APPROVED: "success", REJECTED: "danger", PENDING: "warning", DRAFT: "neutral" } as const;

/** The AI employee itself: what it knows, what it's allowed to do, and the one-pass setup. */
export default async function AdminOrgAgentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const { id } = await params;
  const [d, org] = await Promise.all([
    frontDeskOverview(id),
    prisma.org.findUnique({ where: { id }, select: { name: true, vertical: true } }),
  ]);
  const H = { orgId: id };
  const p = d.profile;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI Front Desk
            <Badge tone={p?.enabled ? "success" : "neutral"}>{p ? (p.enabled ? "on" : "off") : "not set up"}</Badge>
          </CardTitle>
          <CardDescription>
            {p
              ? `${p.businessName} · ${VERTICAL_LABEL[p.vertical] ?? p.vertical} · tone “${p.tone}” · updated ${p.updatedAt.toLocaleDateString("en-GB")}`
              : "No agent profile yet. Run client setup below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-500">Knowledge facts</dt>
            <dd className="font-medium tabular-nums">
              {d.knowledge.active} active · {d.knowledge.draft} draft · {d.knowledge.archived} archived
            </dd>
            <dt className="text-neutral-500">Legacy business info</dt>
            <dd className="font-medium tabular-nums">{p?.businessInfoChars ?? 0} chars</dd>
            <dt className="text-neutral-500">Owner questions pending</dt>
            <dd className="font-medium tabular-nums">{d.pendingQuestions}</dd>
            <dt className="text-neutral-500">Custom actions enabled</dt>
            <dd className="font-medium tabular-nums">{d.customActions}</dd>
            {p?.doNots && (
              <>
                <dt className="text-neutral-500">Do-nots</dt>
                <dd className="text-neutral-800">{p.doNots}</dd>
              </>
            )}
          </dl>
          {p && (
            <div className="mt-4">
              <ActionForm
                action={setAgentEnabledAction}
                hidden={{ ...H, enabled: p.enabled ? "false" : "true" }}
                submitLabel={p.enabled ? "Switch off" : "Switch on"}
                variant={p.enabled ? "secondary" : "primary"}
                confirm={{
                  title: p.enabled ? "Switch the AI Front Desk off?" : "Switch the AI Front Desk on?",
                  description: p.enabled ? "Inbound messages will wait for a human." : "The agent starts replying to customers immediately.",
                  danger: p.enabled,
                }}
                askReason
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Follow-ups (Revenue Recovery)
            <Badge tone={d.followUp?.enabled ? "success" : "neutral"}>{d.followUp ? (d.followUp.enabled ? "on" : "off") : "not installed"}</Badge>
          </CardTitle>
          <CardDescription>The outbound moat: reminders, no-show rebooking, reviews, lead nudges — approved templates only.</CardDescription>
        </CardHeader>
        <CardContent>
          {d.followUp ? (
            <>
              <ul className="grid grid-cols-2 gap-1 text-sm">
                {(
                  [
                    ["bookingReminders", "Booking reminders"],
                    ["noShowRebook", "No-show rebooking"],
                    ["postServiceReview", "Post-service review ask"],
                    ["leadNudge", "Quiet-lead nudge"],
                    ["reminderCalls", "Reminder calls (voice)"],
                  ] as const
                ).map(([k, label]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${d.followUp?.[k] ? "bg-emerald-500" : "bg-neutral-300"}`} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <ActionForm
                  action={setFollowUpsEnabledAction}
                  hidden={{ ...H, enabled: d.followUp.enabled ? "false" : "true" }}
                  submitLabel={d.followUp.enabled ? "Pause follow-ups" : "Enable follow-ups"}
                  variant={d.followUp.enabled ? "secondary" : "primary"}
                  confirm={{ title: d.followUp.enabled ? "Pause all follow-ups?" : "Enable follow-ups?" }}
                  askReason
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Installed by client setup.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Message templates ({d.templates.length})</CardTitle>
          <CardDescription>Meta approval status of the org&apos;s library templates. Rejections show Meta&apos;s reason on hover.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.templates.length === 0 ? (
            <p className="px-5 py-4 text-sm text-neutral-400">No templates yet — client setup installs the vertical pack.</p>
          ) : (
            <ul className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:divide-y-0">
              {d.templates.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-3 px-5 py-2 text-sm" title={t.rejectionReason ?? undefined}>
                  <span className="truncate font-mono text-xs">{t.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-neutral-400">{t.category}</span>
                    <Badge tone={TEMPLATE_TONE[t.metaStatus]}>{t.metaStatus.toLowerCase()}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Concierge client setup</CardTitle>
          <CardDescription>
            One pass: knowledge base → agent persona (switched on) → the vertical&apos;s template pack → follow-up pack.
            Requires the AI Front Desk plan. Re-running overwrites the persona and refreshes the pack; it never deletes
            structured knowledge facts. Calendar and WhatsApp number are connected by the owner (or by you from their
            account) afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setupClientAction}
            hidden={H}
            submitLabel="Run setup"
            variant="primary"
            confirm={{
              title: `Set up ${org?.name ?? "this client"} now?`,
              description: "The agent goes live for inbound replies as soon as this finishes (in test mode nothing reaches Meta).",
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-neutral-600">Business name (as customers know it)</span>
                <input name="businessName" required defaultValue={p?.businessName ?? org?.name ?? ""} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-neutral-600">Vertical</span>
                <select name="vertical" defaultValue={p?.vertical ?? org?.vertical ?? CONCIERGE_VERTICALS[0]} className={`mt-1 ${inputCls}`}>
                  {CONCIERGE_VERTICALS.map((v) => (
                    <option key={v} value={v}>
                      {VERTICAL_LABEL[v] ?? v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opening hours" name="hours" placeholder="Mon–Sat 10:00–19:00, Sun closed" />
              <Field label="Location & directions" name="location" placeholder="2nd floor, Orchid Plaza, Koramangala. Parking behind the building." />
              <Field label="Services" name="services" rows={3} placeholder="Hair transplant (FUE), PRP, beard transplant, consultation" />
              <Field label="Prices" name="prices" rows={3} placeholder="Consultation ₹500 (adjusted against procedure); FUE from ₹45/graft" />
              <Field label="Policies" name="policies" placeholder="Reschedule up to 24h before; 50% advance for procedures" />
              <Field label="FAQs" name="faqs" rows={3} placeholder="Q: Is it painful? A: Local anaesthesia; mild discomfort for a day." />
              <Field label="Tone" name="tone" placeholder="Warm, friendly, and concise" defaultValue={p?.tone} />
              <Field label="Never do / never say" name="doNots" placeholder="Never quote a final price without a consultation; never discuss competitors" defaultValue={p?.doNots} />
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
