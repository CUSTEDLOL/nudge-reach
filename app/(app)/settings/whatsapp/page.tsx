import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { getWhatsappAccount } from "@/lib/whatsapp/accounts";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "WhatsApp settings" };

export default async function WhatsappSettingsPage() {
  const org = await requireOrg();
  const account = await getWhatsappAccount(org.id);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="WhatsApp connection"
        description="Connect your WhatsApp Business account — or keep everything mocked in simulation."
      />

      {env.SEND_MODE === "simulation" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">You&apos;re in simulation mode</p>
            <p className="mt-0.5">
              Everything works without a WhatsApp account — sends and template
              approvals are mocked. Connect a real account here whenever
              you&apos;re ready to go live.
            </p>
          </div>
        </div>
      )}

      {account && (
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
          <p className="mt-1 text-xs text-neutral-500">
            Access token is stored encrypted. Submitting the form below
            replaces this connection.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {account ? "Replace connection" : "Connect manually"}
          </CardTitle>
          <CardDescription>
            From your{" "}
            <a
              href="https://developers.facebook.com"
              className="font-medium text-brand-700 underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Meta developer app
            </a>
            : WhatsApp → API Setup. Embedded Signup comes later — manual works
            for testing with Meta&apos;s test number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm />
        </CardContent>
      </Card>
    </section>
  );
}
