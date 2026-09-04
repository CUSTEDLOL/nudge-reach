import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { checkByoLlm } from "@/modules/billing/limits";
import { getLlmAccount } from "@/modules/ai/llm-account";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "../section-header";
import { AiModelForm } from "./ai-form";

export const metadata: Metadata = { title: "AI model" };

export default async function AiSettingsPage() {
  const ctx = await requireOrgContext();
  const gate = await checkByoLlm(ctx.org.id);

  if (ctx.role === "AGENT" || !gate.allowed) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="AI model"
          description="Run your agent on your own OpenAI, Google or Anthropic account."
        />
        <EmptyState
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title={ctx.role === "AGENT" ? "Managed by admins" : "An Enterprise feature"}
          description={
            ctx.role === "AGENT"
              ? "Ask a workspace admin or the owner to configure the AI model."
              : gate.message
          }
        />
      </section>
    );
  }

  const account = await getLlmAccount(ctx.org.id);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="AI model"
        description="By default your agent runs on Nudge's built-in model. Bring your own provider key and it runs on your account instead — your data agreement, your bill."
      />
      <Card className="flex items-center gap-3 p-4">
        {account ? (
          <>
            <Badge tone="success">Your key</Badge>
            <p className="text-sm text-neutral-600">
              Replies run on <span className="font-mono">{account.model}</span> via{" "}
              {account.provider}. Costs appear on Analytics, billed to your provider
              account.
            </p>
          </>
        ) : (
          <>
            <Badge tone="info">Nudge default</Badge>
            <p className="text-sm text-neutral-600">
              Replies run on Nudge&apos;s built-in model — nothing to configure.
            </p>
          </>
        )}
      </Card>
      <AiModelForm connected={account} />
    </section>
  );
}
