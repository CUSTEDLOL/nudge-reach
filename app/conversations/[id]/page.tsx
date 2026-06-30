import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { SimTester } from "@/app/conversations/sim-tester";

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrg();

  const conversation = await prisma.conversation.findFirst({
    where: { id, orgId: org.id },
    include: {
      contact: { select: { name: true, phoneE164: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm text-neutral-500">
          <Link href="/conversations" className="hover:underline">
            ← Conversations
          </Link>
        </p>
        <h1 className="text-xl font-semibold text-neutral-900">
          {conversation.contact.name}
        </h1>
        <p className="font-mono text-xs text-neutral-400">
          {conversation.contact.phoneE164}
        </p>

        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-[#e5ddd5] p-4">
          {conversation.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.direction === "inbound"
                  ? "self-start rounded-tl-none bg-white text-neutral-800"
                  : "self-end rounded-tr-none bg-[#d9fdd3] text-neutral-900"
              }`}
            >
              {m.body}
            </div>
          ))}
        </div>

        {env.SEND_MODE === "simulation" && (
          <div className="mt-5">
            <SimTester defaultPhone={conversation.contact.phoneE164} />
          </div>
        )}
      </div>
    </main>
  );
}
