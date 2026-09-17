import { permanentRedirect } from "next/navigation";

/** Agent actions moved under the AI Front Desk, beside the rest of its abilities. */
export default function CustomActionsSettingsRedirect() {
  permanentRedirect("/agent/actions");
}
