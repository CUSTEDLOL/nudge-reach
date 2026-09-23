import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
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

type KnowledgeStoreTransaction = Pick<
  Prisma.TransactionClient,
  "$executeRaw" | "knowledgeEntry"
>;

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

async function storeCappedKnowledgeFacts(
  tx: KnowledgeStoreTransaction,
  orgId: string,
  facts: DistilledFact[],
  options: StoreKnowledgeFactsOptions,
): Promise<StoreKnowledgeFactsResult> {
  // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns void, and
  // Prisma cannot deserialize a void column — $queryRaw fails with
  // "Failed to deserialize column of type 'void'" against real Postgres,
  // which no mocked unit test can reproduce. Nothing reads this result; the
  // lock is taken for its side effect and released when the transaction ends.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orgId}, 0))`;
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
}

export async function storeKnowledgeFacts(
  orgId: string,
  facts: DistilledFact[],
  options: StoreKnowledgeFactsOptions,
  transaction?: KnowledgeStoreTransaction,
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

  if (transaction) {
    return storeCappedKnowledgeFacts(transaction, orgId, facts, options);
  }
  return prisma.$transaction((tx) =>
    storeCappedKnowledgeFacts(tx, orgId, facts, options),
  );
}
