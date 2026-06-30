/** WhatsApp 24-hour customer-service window (pure, unit-tested). */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Free-form (session) replies are allowed only within 24h of the customer's
 * last inbound message. Outside it, a business must use an approved template.
 */
export function isWithinServiceWindow(
  lastInboundAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WINDOW_MS;
}
