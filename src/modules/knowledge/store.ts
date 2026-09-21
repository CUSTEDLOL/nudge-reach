import { prisma } from "@/lib/db";
import type { DistilledFact } from "./distill";

type StoredKnowledgeStatus = "active" | "draft";

export interface StoreKnowledgeFactsOptions {
  source: string;
  status: StoredKnowledgeStatus;
  activeDraftCap?: number;
  maxCreated?: number;
}

export interface StoreKnowledgeFactsResult {
  created: number;
  capacityReached: boolean;
}

function normalizedFactKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function selectNewFacts(
  facts: DistilledFact[],
  existing: { fact: string }[],
  limit: number,
): DistilledFact[] {
  if (limit <= 0) return [];
  const known = new Set(existing.map((entry) => normalizedFactKey(entry.fact)));
  const selected: DistilledFact[] = [];
  for (const fact of facts) {
    const key = normalizedFactKey(fact.fact);
    if (!key || known.has(key)) continue;
    known.add(key);
    selected.push(fact);
    if (selected.length >= limit) break;
  }
  return selected;
}

function rowsFor(
  orgId: string,
  facts: DistilledFact[],
  options: StoreKnowledgeFactsOptions,
) {
  return facts.map((fact) => ({
    orgId,
    category: fact.category,
    fact: fact.fact.trim(),
    condition: fact.condition?.trim() || null,
    source: options.source,
    status: options.status,
  }));
}

export async function storeKnowledgeFacts(
  orgId: string,
  facts: DistilledFact[],
  options: StoreKnowledgeFactsOptions,
): Promise<StoreKnowledgeFactsResult> {
  if (options.activeDraftCap === undefined) {
    const existing = await prisma.knowledgeEntry.findMany({
      where: { orgId },
      select: { fact: true },
    });
    const selected = selectNewFacts(
      facts,
      existing,
      options.maxCreated ?? facts.length,
    );
    if (selected.length === 0) return { created: 0, capacityReached: false };
    const inserted = await prisma.knowledgeEntry.createMany({
      data: rowsFor(orgId, selected, options),
    });
    return { created: inserted.count, capacityReached: false };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgId}, 0)) AS locked`;
    const used = await tx.knowledgeEntry.count({
      where: { orgId, status: { in: ["active", "draft"] } },
    });
    const remaining = Math.max(0, options.activeDraftCap! - used);
    if (remaining === 0) return { created: 0, capacityReached: true };
    const existing = await tx.knowledgeEntry.findMany({
      where: { orgId, status: { in: ["active", "draft"] } },
      select: { fact: true },
    });
    const selected = selectNewFacts(
      facts,
      existing,
      Math.min(remaining, options.maxCreated ?? facts.length),
    );
    if (selected.length === 0) {
      return {
        created: 0,
        capacityReached: remaining === 0,
      };
    }
    const inserted = await tx.knowledgeEntry.createMany({
      data: rowsFor(orgId, selected, options),
    });
    return {
      created: inserted.count,
      capacityReached: used + inserted.count >= options.activeDraftCap!,
    };
  });
}
