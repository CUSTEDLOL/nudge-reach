/**
 * Automation trigger entry points (spec §M6). Call sites fire these after the
 * underlying mutation commits; failures are swallowed so a broken automation
 * can never break the primary action.
 *
 * Signatures are frozen: M2/M3 already call them. Loop safety: the add_tag
 * step executor never calls fireTagAdded, so automations adding tags cannot
 * cascade into more tag_added runs.
 */

import {
  matchAutomations,
  runAutomation,
  MAX_AUTOMATIONS_PER_EVENT,
  type AutomationWithSteps,
} from "@/lib/automation/engine";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";

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
  // Notify integrations subscribed to new contacts (fire-and-forget).
  void dispatchWebhook(orgId, "contact.created", { contactId });
  try {
    const matched = await matchAutomations("contact_created", { orgId });
    await runMatched(matched, orgId, contactId, "contact_created");
  } catch (error) {
    console.error("[automations] fireContactCreated failed", error);
  }
}

export async function fireTagAdded(
  orgId: string,
  contactId: string,
  tagName: string
): Promise<void> {
  try {
    const matched = await matchAutomations("tag_added", { orgId, tagName });
    await runMatched(matched, orgId, contactId, "tag_added");
  } catch (error) {
    console.error("[automations] fireTagAdded failed", error);
  }
}

/** Run up to MAX_AUTOMATIONS_PER_EVENT matches; log (never throw) per run. */
async function runMatched(
  matched: AutomationWithSteps[],
  orgId: string,
  contactId: string,
  event: string
): Promise<void> {
  if (matched.length > MAX_AUTOMATIONS_PER_EVENT) {
    console.warn(
      `[automations] ${matched.length} automations matched one ${event} event ` +
        `(org ${orgId}); capping at ${MAX_AUTOMATIONS_PER_EVENT}.`
    );
  }
  for (const automation of matched.slice(0, MAX_AUTOMATIONS_PER_EVENT)) {
    try {
      await runAutomation(automation, { orgId, contactId });
    } catch (error) {
      console.error(
        `[automations] run of "${automation.name}" (${automation.id}) failed`,
        error
      );
    }
  }
}
