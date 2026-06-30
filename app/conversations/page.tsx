import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { SimTester } from "@/app/conversations/sim-tester";

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
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">
              <Link href="/dashboard" className="hover:underline">
                ← Dashboard
              </Link>
            </p>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Conversations
            </h1>
            <p className="text-sm text-neutral-500">
              Assistant is{" "}
              {profile?.enabled ? (
                <span className="font-medium text-emerald-700">ON</span>
              ) : (
                <span className="font-medium text-neutral-500">OFF</span>
              )}{" "}
              ·{" "}
              <Link href="/settings/agent" className="text-emerald-700 underline">
                configure
              </Link>
            </p>
          </div>
        </header>

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
                  className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-emerald-300"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
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
    </main>
  );
}
