import type { Metadata } from "next";
import { PhoneIncoming, PhoneOutgoing, Waypoints } from "lucide-react";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrg } from "@/modules/orgs/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import { ReminderCallsToggle, SimulateCallButton, VoiceNumberForm, VoiceNumberList } from "./voice-form";

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
  const [numbers, followUp] = await Promise.all([
    prisma.voiceNumber.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "asc" } }),
    prisma.followUpConfig.findUnique({ where: { orgId: org.id } }),
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
        {simulation && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-neutral-500">See what a call looks like in your inbox:</p>
            <SimulateCallButton />
          </div>
        )}
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
