/**
 * Wire-format serializers for the public v1 API (snake_case, ISO dates).
 * Not a route file — shared by the /api/v1 handlers.
 */

export const PAGE_SIZE = 50;
export const LEAD_STAGES = new Set(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]);

export function serializeContact(c: {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  leadStage: string;
  optedIn: boolean;
  optedOutAt: Date | null;
  lastContactedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phoneE164,
    email: c.email,
    lead_stage: c.leadStage,
    opted_in: c.optedIn && c.optedOutAt === null,
    opted_out_at: c.optedOutAt?.toISOString() ?? null,
    last_contacted_at: c.lastContactedAt?.toISOString() ?? null,
    created_at: c.createdAt.toISOString(),
  };
}

export function serializeConversation(c: {
  id: string;
  contactId: string;
  status: string;
  lastInboundAt: Date | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  assignedToUserId: string | null;
  createdAt: Date;
}) {
  return {
    id: c.id,
    contact_id: c.contactId,
    status: c.status,
    last_inbound_at: c.lastInboundAt?.toISOString() ?? null,
    last_message_at: c.lastMessageAt?.toISOString() ?? null,
    last_message_preview: c.lastMessagePreview,
    unread_count: c.unreadCount,
    assigned_to_user_id: c.assignedToUserId,
    created_at: c.createdAt.toISOString(),
  };
}

export function serializeMessage(m: {
  id: string;
  direction: string;
  body: string;
  metaMessageId: string | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    direction: m.direction,
    body: m.body,
    provider_message_id: m.metaMessageId,
    created_at: m.createdAt.toISOString(),
  };
}

export function serializeTemplate(t: {
  id: string;
  name: string;
  language: string;
  category: string;
  metaStatus: string;
}) {
  return {
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.metaStatus,
  };
}

export function serializeBooking(b: {
  id: string;
  contactId: string;
  name: string;
  requestedFor: string;
  scheduledFor: Date | null;
  partySize: number | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: b.id,
    contact_id: b.contactId,
    name: b.name,
    requested_for: b.requestedFor,
    scheduled_for: b.scheduledFor?.toISOString() ?? null,
    party_size: b.partySize,
    status: b.status,
    created_at: b.createdAt.toISOString(),
  };
}
