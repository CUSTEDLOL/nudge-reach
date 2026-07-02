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

/**
 * A free-form session/text message — only valid inside the 24-hour customer
 * service window (i.e. replying to a user-initiated conversation). Carries no
 * marketing category, so the consent gate does not block it (the user started
 * the conversation).
 */
export interface TextSend {
  kind: "text";
  text: string;
}

export type MessagePayload = TemplateSend | TextSend;

export interface SendResult {
  ok: boolean;
  /** Provider message id (wamid… live, sim-… simulation). */
  providerMessageId?: string;
  error?: string;
  /** True when the consent gate blocked the send. */
  blockedByConsent?: boolean;
}

/**
 * Per-tenant sender credentials for the live driver. When present, the send
 * uses this org's own WhatsApp number (true multi-tenancy). When absent, the
 * live driver falls back to the single-number env credentials (self-host /
 * agency model). Resolved from the encrypted WhatsappAccount row.
 */
export interface SenderCredentials {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

export interface ChannelDriver {
  send(
    recipient: Recipient,
    payload: MessagePayload,
    credentials?: SenderCredentials
  ): Promise<SendResult>;
}
