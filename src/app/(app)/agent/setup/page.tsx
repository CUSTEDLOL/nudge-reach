import { permanentRedirect } from "next/navigation";

/**
 * Setup is retired. Everything it held now sits where it belongs: the business
 * name, type and tone (and, above them, the house rules) on Training; the
 * opening hours on Bookings. Two pages offering the same settings behind
 * different save buttons was the confusion this product exists to remove.
 */
export default function AgentSetupRedirect() {
  permanentRedirect("/agent");
}
