import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { DistilledFact } from "./distill";

/**
 * `archived` is here for one caller: `migrateProfileToRules` writes the fact
 * lines that did not fit the org's cap as archived rows rather than dropping
 * them. No prompt reads an archived fact and the cap does not count one, so it
 * is the same "kept, not live" state `archiveFactAction` produces.
 */
type StoredKnowledgeStatus = "active" | "draft" | "archived";

export interface StoreKnowledgeFactsOptions {
  source: string;
  status: StoredKnowledgeStatus;
  activeDraftCap?: number;
  maxCreated?: number;
}

export interface StoreKnowledgeFactsResult {
  created: number;
  /**
   * Facts that were new — not duplicates of anything the org already has — and
   * were NOT written, because the cap or the per-run `maxCreated` budget ran
   * out first. It used to be nothing: `selectNewFacts` truncated the list and
   * returned, so a trial with 48 facts migrating a 20-line blob wrote 2 and
   * silently dropped 18 while its caller said "2 draft facts awaiting review."
   * A caller that reports a count to a human must report this one too.
   */
  skipped: number;
  capacityReached: boolean;
}

type KnowledgeStoreTransaction = Pick<
  Prisma.TransactionClient,
  "$executeRaw" | "knowledgeEntry"
>;

function normalizedFactKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Every fact the org does not already carry, in order and with no limit
 * applied — the caller slices it and reports what it left behind. It used to
 * take the limit and break out of the loop at it, which is precisely why an
 * over-cap fact vanished without a trace: the facts past the limit were never
 * counted, so there was nothing to return.
 */
function selectNewFacts(
  facts: DistilledFact[],
  existing: { fact: string }[],
): DistilledFact[] {
  const known = new Set(existing.map((entry) => normalizedFactKey(entry.fact)));
  const selected: DistilledFact[] = [];
  for (const fact of facts) {
    const key = normalizedFactKey(fact.fact);
    if (!key || known.has(key)) continue;
    known.add(key);
    selected.push(fact);
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
  const existing = await tx.knowledgeEntry.findMany({
    where: { orgId, status: { in: ["active", "draft"] } },
    select: { fact: true },
  });
  // Dedupe first, then cut to what fits. A full cap used to return before this
  // read, which was cheaper but could not tell a caller whether the facts it
  // handed over were already known or were being thrown away.
  const eligible = selectNewFacts(facts, existing);
  const room = Math.max(0, Math.min(remaining, options.maxCreated ?? eligible.length));
  const selected = eligible.slice(0, room);
  const skipped = eligible.length - selected.length;
  if (selected.length === 0) {
    return { created: 0, skipped, capacityReached: remaining === 0 };
  }
  const inserted = await tx.knowledgeEntry.createMany({
    data: rowsFor(orgId, selected, options),
  });
  return {
    created: inserted.count,
    skipped,
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
    // No cap means no count to race for, so this path takes no lock — but it
    // must still write through the CALLER's client when there is one, or its
    // rollback leaves these rows behind. `migrateProfileToRules` writes rules
    // and facts in one transaction precisely so a half-migrated org cannot
    // exist; an uncapped fact write that quietly opened its own connection
    // would have put the hole straight back for every paid org.
    const db: KnowledgeStoreTransaction = transaction ?? prisma;
    const existing = await db.knowledgeEntry.findMany({
      where: { orgId },
      select: { fact: true },
    });
    const eligible = selectNewFacts(facts, existing);
    const selected = eligible.slice(
      0,
      Math.max(0, options.maxCreated ?? eligible.length),
    );
    const skipped = eligible.length - selected.length;
    if (selected.length === 0) return { created: 0, skipped, capacityReached: false };
    const inserted = await db.knowledgeEntry.createMany({
      data: rowsFor(orgId, selected, options),
    });
    return { created: inserted.count, skipped, capacityReached: false };
  }

  if (transaction) {
    return storeCappedKnowledgeFacts(transaction, orgId, facts, options);
  }
  return prisma.$transaction((tx) =>
    storeCappedKnowledgeFacts(tx, orgId, facts, options),
  );
}
