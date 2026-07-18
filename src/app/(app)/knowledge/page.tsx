import { permanentRedirect } from "next/navigation";

/** "Train your AI" moved into the AI Agent page (Training tab). */
export default function KnowledgeRedirect() {
  permanentRedirect("/agent");
}
