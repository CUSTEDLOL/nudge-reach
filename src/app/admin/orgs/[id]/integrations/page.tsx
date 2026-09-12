import { requireFounder } from "@/modules/admin/auth";
import { integrationsOverview } from "@/modules/admin/integrations";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import {
  connectWhatsappAction,
  disconnectCalendarAction,
  disconnectCrmAction,
  disconnectLlmAction,
  disconnectNumberAction,
  revokeApiKeyAction,
  setCustomActionEnabledAction,
  setDefaultNumberAction,
  setVoiceNumberEnabledAction,
  setWebhookEnabledAction,
} from "../actions";

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

function statusTone(s: string): BadgeTone {
  if (s === "connected" || s === "active") return "success";
  if (s === "error") return "danger";
  return "neutral";
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">{children}</li>;
}
function Empty({ text }: { text: string }) {
  return <p className="px-5 py-4 text-sm text-neutral-400">{text}</p>;
}

/** Status of everything wired into this org, with the disconnect/revoke levers. */
export default async function AdminOrgIntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const { id } = await params;
  const d = await integrationsOverview(id);
  const H = { orgId: id };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>WhatsApp numbers ({d.whatsapp.length})</CardTitle>
          <CardDescription>
            Meta Cloud API numbers connected to this workspace. Tokens are encrypted and never shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-neutral-900">Connect a number</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Validate official Meta Cloud API credentials, then store the token encrypted.
                Re-entering the same Phone Number ID securely refreshes its credentials.
              </p>
            </div>
            <ActionForm
              action={connectWhatsappAction}
              hidden={H}
              submitLabel="Validate & save"
              variant="primary"
              className="grid items-end gap-4 md:grid-cols-2"
              confirm={{
                title: "Validate and save this WhatsApp number?",
                description:
                  "Meta will verify the WABA, token and Phone Number ID. The token cannot be viewed after it is encrypted.",
              }}
              askReason
            >
              <label className="block text-sm font-medium text-neutral-700">
                Display name
                <input
                  name="displayName"
                  required
                  maxLength={100}
                  placeholder="Clinic WhatsApp"
                  className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                WhatsApp Business Account ID
                <input
                  name="wabaId"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5,40}"
                  autoComplete="off"
                  placeholder="123456789012345"
                  className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Phone Number ID
                <input
                  name="phoneNumberId"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5,40}"
                  autoComplete="off"
                  placeholder="987654321098765"
                  className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Permanent access token
                <input
                  name="accessToken"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={4096}
                  placeholder="Paste the Meta system-user token"
                  className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <p className="text-xs leading-5 text-neutral-500 md:col-span-2">
                Saving credentials does not enable live sending. Review the connection,
                then use Controls to change the workspace mode explicitly.
              </p>
            </ActionForm>
          </div>
          {d.whatsapp.length === 0 ? (
            <Empty text="No number connected — the workspace stays in test mode." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.whatsapp.map((a) => (
                <Row key={a.id}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {a.displayName} {a.isDefault && <Badge tone="brand">default</Badge>}
                    </p>
                    <p className="font-mono text-xs text-neutral-500">
                      phone {a.phoneNumberId} · WABA {a.wabaId}
                    </p>
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  {a.qualityRating && <Badge tone="neutral">quality {a.qualityRating}</Badge>}
                  {!a.isDefault && (
                    <ActionForm action={setDefaultNumberAction} hidden={{ ...H, accountId: a.id }} submitLabel="Make default" variant="ghost" />
                  )}
                  <ActionForm
                    action={disconnectNumberAction}
                    hidden={{ ...H, accountId: a.id }}
                    submitLabel="Disconnect"
                    variant="ghost"
                    confirm={{ title: `Disconnect ${a.displayName}?`, description: "Sends from this number stop immediately. Reconnecting needs a fresh token.", danger: true }}
                    askReason
                    confirmText={{
                      expected: a.displayName,
                      label: `Type “${a.displayName}” to confirm`,
                    }}
                  />
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Where the AI Front Desk books appointments.</CardDescription>
        </CardHeader>
        <CardContent>
          {d.calendar ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {d.calendar.accountEmail} {d.calendar.simulated && <Badge tone="warning">simulated</Badge>}
                </p>
                <p className="text-xs text-neutral-500">
                  {d.calendar.provider} · {d.calendar.calendarId} · updated {fmt(d.calendar.updatedAt)}
                </p>
              </div>
              <Badge tone={statusTone(d.calendar.status)}>{d.calendar.status}</Badge>
              <ActionForm
                action={disconnectCalendarAction}
                hidden={H}
                submitLabel="Disconnect"
                variant="ghost"
                confirm={{ title: "Disconnect the calendar?", description: "Bookings fall back to simulation until the owner reconnects.", danger: true }}
                askReason
                confirmText={{
                  expected: d.calendar.accountEmail,
                  label: `Type “${d.calendar.accountEmail}” to confirm`,
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Not connected. The owner connects it from Settings → Integrations.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI model</CardTitle>
          <CardDescription>Platform model by default; enterprise orgs may bring their own key.</CardDescription>
        </CardHeader>
        <CardContent>
          {d.llm ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {d.llm.provider} · <span className="font-mono text-xs">{d.llm.model}</span>
                </p>
                <p className="text-xs text-neutral-500">Customer-paid (BYOK). Key stored encrypted, {d.llm.hasKey ? "present" : "missing"}.</p>
              </div>
              <ActionForm
                action={disconnectLlmAction}
                hidden={H}
                submitLabel="Remove key"
                variant="ghost"
                confirm={{ title: "Remove the customer's LLM key?", description: "Their traffic moves to Nudge's platform model and cost.", danger: true }}
                askReason
                confirmText={{
                  expected: `${d.llm.provider}/${d.llm.model}`,
                  label: `Type “${d.llm.provider}/${d.llm.model}” to confirm`,
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Using Nudge&apos;s platform model (platform-paid).</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Voice ({d.voiceNumbers.length} number{d.voiceNumbers.length === 1 ? "" : "s"})</CardTitle>
          <CardDescription>
            {d.voice.limit === null
              ? `Unlimited minutes · ${d.voice.used} used this month.`
              : `${d.voice.used} of ${d.voice.limit} minutes used this month${d.voice.exhausted ? " — allowance exhausted, calls refused" : ""}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.voiceNumbers.length === 0 ? (
            <Empty text="No voice numbers." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.voiceNumbers.map((v) => (
                <Row key={v.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {v.label} · <span className="font-mono">{v.phoneE164}</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {v.provider} · {v.language}
                      {v.transferTo && ` · transfers to ${v.transferTo}`}
                    </p>
                  </div>
                  <Badge tone={v.enabled ? "success" : "neutral"}>{v.enabled ? "enabled" : "disabled"}</Badge>
                  <ActionForm
                    action={setVoiceNumberEnabledAction}
                    hidden={{ ...H, voiceNumberId: v.id, enabled: v.enabled ? "false" : "true" }}
                    submitLabel={v.enabled ? "Disable" : "Enable"}
                    variant="ghost"
                    confirm={{ title: `${v.enabled ? "Disable" : "Enable"} ${v.phoneE164}?` }}
                    askReason
                  />
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM ({d.crm.length})</CardTitle>
          <CardDescription>Where qualified leads and bookings are written.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.crm.length === 0 ? (
            <Empty text="No CRM connected." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.crm.map((c) => (
                <Row key={c.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {c.provider} {c.simulated && <Badge tone="warning">simulated</Badge>}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {c.accountLabel || "—"} · last sync {fmt(c.lastSyncAt)}
                      {d.deadJobsByProvider[c.provider] ? ` · ${d.deadJobsByProvider[c.provider]} dead jobs` : ""}
                    </p>
                    {c.lastError && <p className="mt-0.5 truncate text-xs text-red-600" title={c.lastError}>{c.lastError}</p>}
                  </div>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  {c.status !== "disconnected" && (
                    <ActionForm
                      action={disconnectCrmAction}
                      hidden={{ ...H, provider: c.provider }}
                      submitLabel="Disconnect"
                      variant="ghost"
                      confirm={{ title: `Disconnect ${c.provider}?`, danger: true }}
                      askReason
                      confirmText={{
                        expected: c.provider,
                        label: `Type “${c.provider}” to confirm`,
                      }}
                    />
                  )}
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom agent actions ({d.customActions.length})</CardTitle>
          <CardDescription>HTTP actions the agent may call into the client&apos;s own backend.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.customActions.length === 0 ? (
            <Empty text="None configured." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.customActions.map((a) => (
                <Row key={a.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-mono font-medium">{a.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {a.method} {a.url}
                    </p>
                  </div>
                  <Badge tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "enabled" : "disabled"}</Badge>
                  <ActionForm
                    action={setCustomActionEnabledAction}
                    hidden={{ ...H, actionId: a.id, enabled: a.enabled ? "false" : "true" }}
                    submitLabel={a.enabled ? "Disable" : "Enable"}
                    variant="ghost"
                    confirm={{ title: `${a.enabled ? "Disable" : "Enable"} ${a.name}?` }}
                    askReason
                  />
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys ({d.apiKeys.filter((k) => !k.revokedAt).length} active)</CardTitle>
          <CardDescription>Developer API access. Only the prefix is ever visible.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.apiKeys.length === 0 ? (
            <Empty text="No API keys." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.apiKeys.map((k) => (
                <Row key={k.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {k.name} <span className="font-mono text-xs text-neutral-500">{k.prefix}…</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      created {fmt(k.createdAt)} · last used {fmt(k.lastUsedAt)}
                    </p>
                  </div>
                  {k.revokedAt ? (
                    <Badge tone="neutral">revoked</Badge>
                  ) : (
                    <ActionForm
                      action={revokeApiKeyAction}
                      hidden={{ ...H, keyId: k.id }}
                      submitLabel="Revoke"
                      variant="ghost"
                      confirm={{ title: `Revoke "${k.name}"?`, description: "Any integration using it stops working immediately.", danger: true }}
                      askReason
                      confirmText={{
                        expected: k.prefix,
                        label: `Type “${k.prefix}” to confirm`,
                      }}
                    />
                  )}
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbound webhooks ({d.webhooks.length})</CardTitle>
          <CardDescription>Endpoints that receive this org&apos;s events. Failures counted over 7 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {d.webhooks.length === 0 ? (
            <Empty text="No webhook endpoints." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.webhooks.map((w) => (
                <Row key={w.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-mono text-xs font-medium" title={w.url}>{w.url}</p>
                    <p className="text-xs text-neutral-500">
                      last {w.lastStatus ?? "—"} at {fmt(w.lastDeliveryAt)}
                      {w._count.deliveries > 0 && <span className="text-red-600"> · {w._count.deliveries} failed / 7d</span>}
                    </p>
                  </div>
                  <Badge tone={w.enabled ? "success" : "neutral"}>{w.enabled ? "enabled" : "disabled"}</Badge>
                  <ActionForm
                    action={setWebhookEnabledAction}
                    hidden={{ ...H, endpointId: w.id, enabled: w.enabled ? "false" : "true" }}
                    submitLabel={w.enabled ? "Disable" : "Enable"}
                    variant="ghost"
                    confirm={{ title: `${w.enabled ? "Disable" : "Enable"} this endpoint?` }}
                    askReason
                  />
                </Row>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
