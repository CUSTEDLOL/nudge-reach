import type { Metadata } from "next";
import {
  CalendarCheck,
  PhoneCall,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { requireOrg } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import { ConnectForm } from "./connect-form";
import { GoLiveChecklist } from "./go-live-checklist";

export const metadata: Metadata = { title: "WhatsApp settings" };

const SETUP_CALL_URL = "https://cal.com/hqnudge/30min";

const SETUP_NEEDS = [
  {
    icon: Smartphone,
    title: "A number for your business",
    body: "A fresh SIM or landline that isn't already on the WhatsApp app — or we migrate your existing one.",
  },
  {
    icon: ShieldCheck,
    title: "Your Facebook / Meta login",
    body: "We create the WhatsApp Business Account under your name. You own it, always.",
  },
  {
    icon: CalendarCheck,
    title: "Your Google Calendar",
    body: "Optional — one click lets the AI book real appointments.",
  },
];

export default async function WhatsappSettingsPage() {
  const org = await requireOrg();
  const account = await getWhatsappAccount(org.id);
  const simulation = env.SEND_MODE === "simulation";

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="WhatsApp number"
        description="Your AI Front Desk answers from your own WhatsApp Business number. We connect it with you."
      />

      {account ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Connected</Badge>
            <p className="text-sm font-semibold text-neutral-900">
              {account.displayName}
            </p>
          </div>
          <p className="mt-2 font-mono text-xs text-neutral-500">
            WABA {account.wabaId} · Phone {account.phoneNumberId}
          </p>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={simulation ? "info" : "warning"}>
              {simulation ? "Test mode" : "Not connected yet"}
            </Badge>
            <p className="text-sm font-semibold text-neutral-900">
              {simulation
                ? "Your AI runs in test mode until your number is connected"
                : "No number connected yet"}
            </p>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            Try the AI, teach it your business and import contacts now —
            nothing reaches real customers until your number is live.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>We connect your number for you</CardTitle>
          <CardDescription>
            One 30-minute setup call. Have these ready and you&apos;re live the
            same day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-3">
            {SETUP_NEEDS.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-neutral-200 p-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-2 text-sm font-medium text-neutral-900">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
          <a
            href={SETUP_CALL_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ className: "mt-5" })}
          >
            <PhoneCall className="h-4 w-4" aria-hidden />
            Book your setup call
          </a>
        </CardContent>
      </Card>

      <GoLiveChecklist orgId={org.id} />

      <details className="rounded-2xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-neutral-700">
          Advanced: connect manually
          <span className="ml-2 font-normal text-neutral-400">
            for teams with their own Meta developer app
          </span>
        </summary>
        <div className="border-t border-neutral-100 px-5 py-5">
          <p className="mb-4 text-sm text-neutral-500">
            From your Meta developer app: WhatsApp → API Setup.
            {account && " Saving here replaces the current connection."}
          </p>
          <ConnectForm />
        </div>
      </details>
    </section>
  );
}
