import { permanentRedirect } from "next/navigation";

/** Voice moved under the AI Front Desk — it is part of the employee, not account admin. */
export default function VoiceSettingsRedirect() {
  permanentRedirect("/agent/voice");
}
