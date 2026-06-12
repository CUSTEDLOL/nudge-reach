import { env } from "@/lib/env";
import { canSendMarketing } from "@/lib/consent";
import { WhatsappLiveDriver } from "@/lib/messaging/drivers/whatsapp-live";
import { WhatsappSimulationDriver } from "@/lib/messaging/drivers/whatsapp-simulation";
import type {
  Channel,
  ChannelDriver,
  MessagePayload,
  Recipient,
  SendResult,
} from "@/lib/messaging/types";

export type { Channel, MessagePayload, Recipient, SendResult };

function resolveDriver(channel: Channel): ChannelDriver {
  switch (channel) {
    case "whatsapp":
      return env.SEND_MODE === "live"
        ? new WhatsappLiveDriver()
        : new WhatsappSimulationDriver();
  }
}

/**
 * The single send entry point. The consent gate lives HERE, at the lowest
 * layer (rule 2) — a MARKETING payload to a non-consenting recipient is
 * refused no matter what the UI or queue above did.
 */
export async function sendMessage(
  channel: Channel,
  recipient: Recipient,
  payload: MessagePayload
): Promise<SendResult> {
  if (payload.category === "MARKETING" && !canSendMarketing(recipient)) {
    return {
      ok: false,
      blockedByConsent: true,
      error: "Recipient has not opted in to marketing (or has opted out).",
    };
  }
  return resolveDriver(channel).send(recipient, payload);
}
