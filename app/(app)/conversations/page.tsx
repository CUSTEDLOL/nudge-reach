import { redirect } from "next/navigation";

/** /conversations moved to the shared inbox (spec §3.6). */
export default function ConversationsRedirect() {
  redirect("/inbox");
}
