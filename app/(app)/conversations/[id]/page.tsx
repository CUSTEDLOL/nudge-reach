import { redirect } from "next/navigation";

/** /conversations/[id] moved to the shared inbox (spec §3.6). */
export default async function ConversationRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/inbox/${id}`);
}
