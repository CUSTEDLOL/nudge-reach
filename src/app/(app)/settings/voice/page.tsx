import type { Metadata } from "next";
import { PhoneIncoming, PhoneOutgoing, Waypoints } from "lucide-react";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrg } from "@/modules/orgs/auth";
import { checkVoiceAgent } from "@/modules/billing/limits";
import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { voiceUsage } from "@/modules/voice/usage";
import { SectionHeader } from "../section-header";
import { ReminderCallsToggle, SimulateCallButton, VoiceNumberForm, VoiceNumberList } from "./voice-form";
import { BrowserCallButton } from "./browser-call";

export const metadata: Metadata = { title: "Voice settings" };

const HOW_IT_WORKS = [
  {
    icon: PhoneIncoming,
    title: "Answers every call",
    body: "Same knowledge, same tone as your WhatsApp front desk. Books, takes leads, sends payment links.",
  },
  {
    icon: PhoneOutgoing,
    title: "Calls no-shows and reminders",
    body: "Optional: a friendly confirmation call two hours before each booking.",
  },
  {
    icon: Waypoints,
    title: "Hands over when it should",
    body: "Asks for a person? The call transfers to your number and the transcript lands in your inbox.",
  },
];

export default async function VoiceSettingsPage() {
  const org = await requireOrg();
  // E7 fix: the voice front desk is a front_desk/enterprise feature.
  const gate = await checkVoiceAgent(org.id);
  if (!gate.allowed) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Phone calls"
          description="Your AI Front Desk picks up the phone too."
        />
        <EmptyState
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title="An AI Front Desk feature"
          description={gate.message}
        />
      </section>
    );
  }
  const [numbers, followUp, usage] = await Promise.all([
    prisma.voiceNumber.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "asc" } }),
    prisma.followUpConfig.findUnique({ where: { orgId: org.id } }),
    voiceUsage(org.id),
  ]);
  const simulation = isSimulated(org);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Phone calls"
        description="Your AI Front Desk picks up the phone too — on a number we connect for you."
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {numbers.length ? (
            <Badge tone="success">Connected</Badge>
          ) : (
            <Badge tone={simulation ? "info" : "warning"}>{simulation ? "Test mode" : "No number yet"}</Badge>
          )}
          <p className="text-sm font-semibold text-neutral-900">
            {numbers.length
              ? `${numbers.length} number${numbers.length > 1 ? "s" : ""} answered by your AI`
              : simulation
                ? "Calls are simulated until a number is connected"
                : "Add a number below to start answering calls"}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-neutral-500">
            Hear it for yourself — no phone number needed:
          </p>
          <BrowserCallButton />
          {simulation && <SimulateCallButton />}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call minutes this month</CardTitle>
          <CardDescription>
            {usage.limit === null
              ? "Your plan includes unlimited call minutes."
              : `Your plan includes ${usage.limit} minutes a month. They reset on the 1st.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-900">
              {usage.used} {usage.limit === null ? "minutes used" : `of ${usage.limit} minutes used`}
            </p>
            {usage.limit !== null && (
              <Badge tone={usage.exhausted ? "warning" : usage.remaining !== null && usage.remaining <= 10 ? "info" : "neutral"}>
                {usage.exhausted ? "No minutes left" : `${usage.remaining} left`}
              </Badge>
            )}
          </div>
          {usage.limit !== null && (
            <Progress
              className="mt-3"
              value={Math.min(usage.used, usage.limit)}
              max={usage.limit}
              label="Call minutes used this month"
            />
          )}
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            {usage.exhausted
              ? "Your AI has stopped answering calls until the 1st. Talk to us to add minutes — WhatsApp keeps working as normal."
              : "Every call counts as whole minutes. When the minutes run out the AI stops answering calls; WhatsApp is unaffected."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What it does</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.title} className="rounded-xl border border-neutral-200 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-2 text-sm font-medium text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{item.body}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminder calls</CardTitle>
          <CardDescription>Opt-in per business. Off by default.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderCallsToggle enabled={followUp?.reminderCalls ?? false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numbers</CardTitle>
          <CardDescription>
            India: an Exotel number routed to our voice platform. Elsewhere: a Twilio number. We set this up on the
            onboarding call.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <VoiceNumberList
            numbers={numbers.map((n) => ({
              id: n.id,
              phoneE164: n.phoneE164,
              provider: n.provider,
              label: n.label,
              transferTo: n.transferTo,
              language: n.language,
              enabled: n.enabled,
            }))}
          />
          <details className="rounded-2xl border border-neutral-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-neutral-700">
              Add or update a number
              <span className="ml-2 font-normal text-neutral-400">carrier, language, transfer number</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-5">
              <VoiceNumberForm />
            </div>
          </details>
        </CardContent>
      </Card>
    </section>
  );
}
