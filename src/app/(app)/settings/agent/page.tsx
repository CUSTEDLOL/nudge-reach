import { permanentRedirect } from "next/navigation";

/** Agent setup moved into the AI Agent page (Setup tab). */
export default function AgentSettingsRedirect() {
  permanentRedirect("/agent?tab=setup");
}
