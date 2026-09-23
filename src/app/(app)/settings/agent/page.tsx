import { permanentRedirect } from "next/navigation";

/** Agent setup is the Training page now — one place, one save button. */
export default function AgentSettingsRedirect() {
  permanentRedirect("/agent");
}
