import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { prisma } from "@/lib/db";
import { getConciergeStatus } from "@/modules/concierge";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ConciergeForm } from "./concierge-form";

export const metadata: Metadata = { title: "Concierge setup" };

export default async function ConciergePage() {
  const ctx = await requireOrgContext();

  if (ctx.role === "AGENT") {
    return (
      <>
        <PageHeader title="Concierge setup" description="Done-for-you client onboarding." />
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Concierge setup is for admins"
          description="Ask a workspace admin or the owner to run the client setup."
        />
      </>
    );
  }

  const [profile, status] = await Promise.all([
    prisma.agentProfile.findUnique({ where: { orgId: ctx.org.id } }),
    getConciergeStatus(ctx.org.id),
  ]);
  const hasFrontDesk = planHasAiFrontDesk(ctx.org.plan);

  const defaults = {
    businessName: profile?.businessName ?? ctx.org.name,
    vertical:
      profile?.vertical === "salon" || profile?.vertical === "clinic"
        ? profile.vertical
        : "clinic",
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
    hours: "",
    location: "",
    services: "",
    prices: "",
    policies: "",
    faqs: "",
  };

  const gate = [
    { done: status.agentConfigured, title: "Knowledge base + agent persona" },
    { done: status.agentEnabled, title: "AI agent switched on" },
    {
      done: status.approvedTemplates > 0,
      title: `Approved templates (${status.approvedTemplates})`,
    },
    { done: status.followUpEnabled, title: "Revenue-Recovery follow-ups on" },
    {
      done: status.calendarConnected,
      title: "Google Calendar connected",
      href: "/integrations",
      linkLabel: "Connect calendar",
    },
  ];
  const doneCount = gate.filter((g) => g.done).length;

  return (
    <>
      <PageHeader
        title="Concierge setup"
        description="Set up a client's AI Front Desk in one pass — knowledge base, template pack and follow-ups. Then connect their calendar to go live."
      />

      {!hasFrontDesk && (
        <Card className="mb-6 border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-800">
            Concierge onboarding is part of the <strong>AI Front Desk</strong>{" "}
            plan. Upgrade in Settings → Billing to run a client setup.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-6">
          <ConciergeForm defaults={defaults} />
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Go-live gate
              </h2>
              <Badge tone={status.ready ? "success" : "neutral"}>
                {doneCount} of {gate.length}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Computed from real state — all green means the client is ready.
            </p>
            <ol className="mt-4 flex flex-col gap-3">
              {gate.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  {item.done ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">{item.title}</p>
                    {!item.done && item.href && (
                      <Link
                        href={item.href}
                        className={buttonVariants({ variant: "secondary" }) + " mt-1.5"}
                      >
                        {item.linkLabel}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
