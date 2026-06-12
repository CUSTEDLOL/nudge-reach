/**
 * Platform module: channel-agnostic messaging types. Product 2 adds an
 * "email" channel behind the same interface.
 */

export type Channel = "whatsapp"; // | "email" (product 2)

export interface Recipient {
  /** Channel address: E.164 phone for whatsapp, email address later. */
  address: string;
  /** Consent fields — the driver layer re-checks the gate before sending. */
  optedIn: boolean;
  optedOutAt: Date | null;
}

/** A pre-approved template send (the only kind of marketing send Meta allows). */
export interface TemplateSend {
  kind: "template";
  category: "MARKETING" | "UTILITY";
  templateName: string;
  language: string;
  /** Ordered body variable values, e.g. ["Priya"] for {{1}}. */
  bodyParams: string[];
  /** Public URL for an image header, if the template has one. */
  headerImageUrl?: string;
}

export type MessagePayload = TemplateSend;

export interface SendResult {
  ok: boolean;
  /** Provider message id (wamid… live, sim-… simulation). */
  providerMessageId?: string;
  error?: string;
  /** True when the consent gate blocked the send. */
  blockedByConsent?: boolean;
}

export interface ChannelDriver {
  send(recipient: Recipient, payload: MessagePayload): Promise<SendResult>;
}
