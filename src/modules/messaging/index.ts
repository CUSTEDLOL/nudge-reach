import { env } from "@/lib/env";
import { canSendMarketing } from "@/modules/consent";
import { getWhatsappCredentials } from "@/modules/whatsapp/accounts";
import { WhatsappLiveDriver } from "@/modules/messaging/drivers/whatsapp-live";
import { WhatsappSimulationDriver } from "@/modules/messaging/drivers/whatsapp-simulation";
import type {
  Channel,
  ChannelDriver,
  MessagePayload,
  Recipient,
  SendResult,
  SenderCredentials,
} from "@/modules/messaging/types";

export type { Channel, MessagePayload, Recipient, SendResult };

function resolveDriver(channel: Channel): ChannelDriver {
  switch (channel) {
    case "whatsapp":
      return env.SEND_MODE === "live"
        ? new WhatsappLiveDriver()
        : new WhatsappSimulationDriver();
  }
}

/** Options for a send: which org's number to send from (multi-tenant). */
export interface SendOptions {
  /** Org whose connected WhatsApp number should send this (live mode). */
  orgId?: string;
}

/**
 * The single send entry point. The consent gate lives HERE, at the lowest
 * layer (rule 2) — a MARKETING payload to a non-consenting recipient is
 * refused no matter what the UI or queue above did.
 */
export async function sendMessage(
  channel: Channel,
  recipient: Recipient,
  payload: MessagePayload,
  options: SendOptions = {}
): Promise<SendResult> {
  // Consent gate (rule 2) applies to MARKETING templates only. Free-form text
  // replies are answers to a user-initiated conversation and don't require
  // marketing opt-in.
  if (
    payload.kind === "template" &&
    payload.category === "MARKETING" &&
    !canSendMarketing(recipient)
  ) {
    return {
      ok: false,
      blockedByConsent: true,
      error: "Recipient has not opted in to marketing (or has opted out).",
    };
  }

  // Resolve this org's own WhatsApp credentials (multi-tenant). Falls back to
  // the env single-number credentials inside the driver when none are stored.
  let credentials: SenderCredentials | undefined;
  if (channel === "whatsapp" && env.SEND_MODE === "live" && options.orgId) {
    const creds = await getWhatsappCredentials(options.orgId);
    if (creds) {
      credentials = {
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        apiVersion: env.WHATSAPP_API_VERSION,
      };
    }
  }

  return resolveDriver(channel).send(recipient, payload, credentials);
}
