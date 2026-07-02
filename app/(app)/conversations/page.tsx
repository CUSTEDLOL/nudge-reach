import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { SimTester } from "./sim-tester";

export default async function ConversationsPage() {
  const org = await requireOrg();
  const [conversations, profile] = await Promise.all([
    prisma.conversation.findMany({
      where: { orgId: org.id },
      include: {
        contact: { select: { name: true, phoneE164: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.agentProfile.findUnique({ where: { orgId: org.id } }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Conversations"
        description={
          <>
            Assistant is{" "}
            {profile?.enabled ? (
              <span className="font-medium text-emerald-700">ON</span>
            ) : (
              <span className="font-medium text-neutral-500">OFF</span>
            )}{" "}
            ·{" "}
            <Link href="/settings/agent" className="text-brand-700 underline">
              configure
            </Link>
          </>
        }
      />

      {env.SEND_MODE === "simulation" && (
        <div className="mb-6">
          <SimTester defaultPhone="+919810000001" />
        </div>
      )}

      {conversations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No conversations yet.{" "}
          {env.SEND_MODE === "simulation"
            ? "Use the tester above to start one."
            : "They'll appear here when customers message your WhatsApp."}
        </p>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/conversations/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-soft transition-colors duration-150 hover:border-brand-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {c.contact.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">
                    {c.contact.name}
                  </p>
                  <p className="truncate text-sm text-neutral-500">
                    {c.messages[0]?.body ?? "No messages"}
                  </p>
                </div>
                {c.status === "handoff" && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Needs you
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
