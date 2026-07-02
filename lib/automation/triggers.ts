/**
 * Automation trigger entry points (spec §M6). Call sites fire these after the
 * underlying mutation commits; failures are swallowed so a broken automation
 * can never break the primary action.
 *
 * Contract stubs — M6 wires them into the automation engine. Signatures are
 * frozen: M2/M3 already call them.
 */

export interface TriggerContext {
  contactId: string;
  conversationId?: string;
  /** Inbound message text, for keyword/campaign_reply triggers. */
  messageText?: string;
  /** Tag name, for tag_added triggers. */
  tagName?: string;
}

export async function fireContactCreated(
  orgId: string,
  contactId: string
): Promise<void> {
  void orgId;
  void contactId;
  // Implemented by the automation engine (lib/automation/engine.ts).
}

export async function fireTagAdded(
  orgId: string,
  contactId: string,
  tagName: string
): Promise<void> {
  void orgId;
  void contactId;
  void tagName;
  // Implemented by the automation engine (lib/automation/engine.ts).
}
