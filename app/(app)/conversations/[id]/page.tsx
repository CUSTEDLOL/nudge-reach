import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { SimTester } from "../sim-tester";

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
    <div className="max-w-2xl">
      <p className="mb-2 text-sm text-neutral-500">
        <Link href="/conversations" className="hover:underline">
          ← Conversations
        </Link>
      </p>
      <PageHeader
        title={conversation.contact.name}
        description={
          <span className="font-mono text-xs text-neutral-400">
            {conversation.contact.phoneE164}
          </span>
        }
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-[#e5ddd5] p-4">
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
  );
}
