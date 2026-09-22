/**
 * Nudge's own public contact points. Shared by the contact page and the
 * footer so the number lives in one place — two copies of a phone number is
 * how one of them quietly goes stale.
 */

/** The WABA number behind our own AI Front Desk (wa.me wants bare digits). */
export const WHATSAPP_NUMBER = "6581373154";

export const WHATSAPP_PREFILL =
  "Hi Nudge — I'd like to know more about the AI Front Desk.";

export const CONTACT_EMAIL = "hqnudge@gmail.com";

export function whatsappHref(prefill: string = WHATSAPP_PREFILL): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefill)}`;
}
