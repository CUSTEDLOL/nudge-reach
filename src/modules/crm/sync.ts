import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { listConnections, providerFor, withAccessToken } from "@/modules/crm/connections";
import type {
  ConnectionRow,
  CrmActivity,
  CrmEvent,
  CrmLead,
  CrmProviderKey,
  CrmStage,
} from "@/modules/crm/types";

/**
 * Product code never calls a CRM directly: it enqueues an event; the cron tick
 * maps events to provider calls, one in-flight job per connection per tick,
 * with backoff and a dead-letter state. Idempotent per (event, entity).
 */

export type CrmPayload =
  | { kind: "lead"; lead: CrmLead }
  | { kind: "stage"; phoneE164: string; stage: CrmStage }
  | { kind: "activity"; phoneE164: string; activity: CrmActivity };

const BACKOFF = [1, 5, 30, 120, 480];

export function backoffMinutes(attempt: number): number {
  return BACKOFF[Math.min(Math.max(attempt, 1), BACKOFF.length) - 1];
}

export async function enqueueCrmEvent(
  orgId: string,
  event: CrmEvent,
  entityId: string,
  payload: CrmPayload
): Promise<void> {
  const connections = (await listConnections(orgId)).filter((c) => c.status === "connected");
  for (const c of connections) {
    await prisma.crmSyncJob.upsert({
      where: { orgId_provider_event_entityId: { orgId, provider: c.provider, event, entityId } },
      create: { orgId, provider: c.provider, event, entityId, payload: payload as unknown as Prisma.InputJsonValue },
      update: {},
    });
  }
}

/** The CRM record for a phone: the done contact.created job, else upsert now. */
async function leadIdFor(
  job: { orgId: string; provider: string },
  phoneE164: string,
  conn: ConnectionRow,
  org: { simulated: boolean },
  fallback: CrmLead
): Promise<string> {
  const contactJob = await prisma.crmSyncJob.findFirst({
    where: {
      orgId: job.orgId,
      provider: job.provider,
      event: "contact.created",
      status: "done",
      payload: { path: ["lead", "phoneE164"], equals: phoneE164 },
    },
  });
  if (contactJob?.externalId) return contactJob.externalId;
  const p = providerFor(job.provider as CrmProviderKey, org);
  return (await p.upsertLead(conn, fallback)).externalId;
}

export async function tickCrmSync(
  now: Date = new Date()
): Promise<{ done: number; failed: number; dead: number }> {
  const result = { done: 0, failed: 0, dead: 0 };
  const jobs = await prisma.crmSyncJob.findMany({
    where: { status: "pending", nextRunAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const seen = new Set<string>(); // one in-flight job per connection per tick
  for (const job of jobs) {
    const lane = `${job.orgId}:${job.provider}`;
    if (seen.has(lane)) continue;
    seen.add(lane);
    try {
      const org = await prisma.org.findUnique({
        where: { id: job.orgId },
        select: { id: true, simulated: true },
      });
      if (!org) throw new Error("org missing");
      const connRow = (await listConnections(job.orgId)).find(
        (c) => c.provider === job.provider && c.status === "connected"
      );
      if (!connRow) throw new Error("connection missing");
      const conn: ConnectionRow =
        org.simulated || connRow.simulated
          ? {
              id: connRow.id,
              orgId: job.orgId,
              provider: job.provider as CrmProviderKey,
              apiDomain: "",
              accountsServer: "",
              accessToken: "",
            }
          : await withAccessToken(connRow.id);
      const provider = providerFor(job.provider as CrmProviderKey, org);
      const payload = job.payload as unknown as CrmPayload;
      let externalId: string | null = null;
      if (payload.kind === "lead") {
        externalId = (await provider.upsertLead(conn, payload.lead)).externalId;
      } else {
        const fallback: CrmLead = { phoneE164: payload.phoneE164, name: payload.phoneE164, source: "WhatsApp (Nudge)" };
        externalId = await leadIdFor(job, payload.phoneE164, conn, org, fallback);
        if (payload.kind === "stage") await provider.updateStage(conn, externalId, payload.stage);
        else await provider.logActivity(conn, externalId, payload.activity);
      }
      await prisma.crmSyncJob.update({
        where: { id: job.id },
        data: { status: "done", externalId, error: null, attempts: job.attempts + 1 },
      });
      await prisma.crmConnection.update({ where: { id: connRow.id }, data: { lastSyncAt: now, lastError: null } });
      result.done += 1;
    } catch (e) {
      const attempts = job.attempts + 1;
      const dead = attempts >= BACKOFF.length;
      await prisma.crmSyncJob.update({
        where: { id: job.id },
        data: {
          attempts,
          error: (e as Error).message.slice(0, 500),
          status: dead ? "dead" : "pending",
          nextRunAt: new Date(now.getTime() + backoffMinutes(attempts) * 60_000),
        },
      });
      if (dead) result.dead += 1;
      else result.failed += 1;
    }
  }
  return result;
}
