import { permanentRedirect } from "next/navigation";

/** Agent setup moved to its own page under the AI Front Desk. */
export default function AgentSettingsRedirect() {
  permanentRedirect("/agent/setup");
}
