import type {
  ChannelDriver,
  MessagePayload,
  Recipient,
  SendResult,
} from "@/modules/messaging/types";

/**
 * Simulation driver (rule 5): mocks Meta responses so the entire flow is
 * demoable with no WhatsApp Business Account. Returns a fake message id in
 * the same shape live code expects. Status-event simulation (delivered/read)
 * arrives in Phase 4 with the send queue.
 */
export class WhatsappSimulationDriver implements ChannelDriver {
  async send(
    recipient: Recipient,
    payload: MessagePayload
  ): Promise<SendResult> {
    void payload;
    const id = `sim-${recipient.address.replace(/\D/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    return { ok: true, providerMessageId: id };
  }
}
