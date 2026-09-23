import { beforeEach, describe, expect, it, vi } from "vitest";

/** Overview aggregation math on mocked prisma groupBy shapes. */
const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    conversation: { groupBy: vi.fn() },
    conversationMessage: { findMany: vi.fn(), groupBy: vi.fn() },
    aiUsage: { groupBy: vi.fn() },
    bookingRequest: { count: vi.fn() },
    paymentRequest: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import {
  ORG_READINESS,
  ORG_SORTS,
  orgsList,
  orgsWhere,
  overviewStats,
  paginate,
  sortOrgRows,
  type OrgRow,
} from "@/modules/admin/queries";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.count.mockResolvedValue(12);
  prisma.org.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
    by[0] === "plan"
      ? [
          { plan: "free", _count: 8 },
          { plan: "growth", _count: 3 },
          { plan: "enterprise", _count: 1 },
        ]
      : [
          { simulated: true, _count: 10 },
          { simulated: false, _count: 2 },
        ]
  );
  prisma.org.findMany.mockResolvedValue([
    { createdAt: new Date() },
    { createdAt: new Date() },
  ]);
  prisma.conversationMessage.findMany.mockResolvedValue([
    { conversation: { orgId: "a" } },
    { conversation: { orgId: "a" } },
    { conversation: { orgId: "b" } },
  ]);
  prisma.conversationMessage.groupBy.mockResolvedValue([
    { direction: "inbound", _count: 40 },
    { direction: "outbound", _count: 55 },
  ]);
  prisma.aiUsage.groupBy.mockResolvedValue([
    { byok: false, _sum: { costMicroUsd: 3_000_000 } },
    { byok: true, _sum: { costMicroUsd: 1_000_000 } },
  ]);
  prisma.bookingRequest.count.mockResolvedValue(7);
  prisma.paymentRequest.count.mockResolvedValue(4);
});

describe("overviewStats", () => {
  it("aggregates plan, mode, activity, cost and volume correctly", async () => {
    const s = await overviewStats(30);
    expect(s.orgsTotal).toBe(12);
    expect(s.orgsByPlan[0]).toEqual({ plan: "free", count: 8 });
    expect(s.liveOrgs).toBe(2);
    expect(s.testOrgs).toBe(10);
    expect(s.signupsInRange).toBe(2);
    expect(s.signupsByDay).toHaveLength(30);
    expect(s.signupsByDay.at(-1)?.count).toBe(2); // both signups today
    expect(s.activeOrgs).toBe(2); // distinct orgs a + b
    expect(s.messagesInbound).toBe(40);
    expect(s.messagesOutbound).toBe(55);
    expect(s.aiCostMicroUsd).toBe(4_000_000);
    expect(s.aiCostByokMicroUsd).toBe(1_000_000);
    expect(s.bookings).toBe(7);
    expect(s.paymentsPaid).toBe(4);
  });

  it("never selects message bodies (privacy rule)", async () => {
    await overviewStats(7);
    for (const call of prisma.conversationMessage.findMany.mock.calls) {
      const select = call[0]?.select ?? {};
      expect(select).not.toHaveProperty("body");
    }
  });
});

describe("orgsList", () => {
  const makeOrg = (id: string) => ({
    id,
    name: `Org ${id}`,
    plan: "growth",
    simulated: true,
    suspendedAt: null,
    trialEndsAt: null,
    // A ready workspace is inside a paid month; without one the AI has no credits.
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    vertical: "clinic",
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, Number(id.slice(1)) || 1)),
    memberships: [{ email: `${id}@x.com` }],
    whatsappAccounts: [{ id: `wa-${id}` }],
    agentProfile: { enabled: true },
    calendarAccount: { status: "connected" },
    // A ready workspace is grounded in what the prompt actually carries. This
    // fixture used to be `knowledgeEntries: []` with a full `businessInfo`,
    // which is precisely the state the readiness gate now (correctly) flags:
    // no builder has read that column since fe85add.
    knowledgeEntries: [{ id: `knowledge-${id}` }],
    agentRules: [],
    templates: [{ id: `template-${id}` }],
    followUpConfig: { enabled: true },
    _count: { contacts: 3, whatsappAccounts: 1, memberships: 2 },
  });

  beforeEach(() => {
    prisma.aiUsage.groupBy.mockResolvedValue([
      { orgId: "o1", _sum: { costMicroUsd: 2_000_000 } },
    ]);
    prisma.conversation.groupBy.mockResolvedValue([
      { orgId: "o1", _max: { lastInboundAt: new Date("2026-09-01") } },
    ]);
  });

  it("returns numeric pages after merging cost and last-inbound data", async () => {
    prisma.org.findMany.mockResolvedValue(
      Array.from({ length: 55 }, (_, i) => makeOrg(`o${i + 1}`))
    );
    const page = await orgsList({ page: 2 });
    expect(page.page).toBe(2);
    expect(page.pageCount).toBe(2);
    expect(page.total).toBe(55);
    expect(page.rows).toHaveLength(5);
    const args = prisma.org.findMany.mock.calls.at(-1)![0];
    expect(args.take).toBe(500);
    expect(args).not.toHaveProperty("cursor");
  });

  it("merges costs and activity before deterministic sorting", async () => {
    prisma.org.findMany.mockResolvedValue([makeOrg("o1"), makeOrg("o2")]);
    const page = await orgsList({ sort: "cost" });
    expect(page.rows).toHaveLength(2);
    expect(page.rows[0].aiCostMicroUsd30d).toBe(2_000_000);
    expect(page.rows[0].lastInboundAt).toEqual(new Date("2026-09-01"));
    expect(page.rows[1].aiCostMicroUsd30d).toBe(0);
  });

  it("passes search into the bounded query and selects no secret or message content", async () => {
    prisma.org.findMany.mockResolvedValue([makeOrg("o1")]);
    await orgsList({ search: "spice" });
    const args = prisma.org.findMany.mock.calls.at(-1)![0];
    expect(JSON.stringify(args.where)).toContain("spice");
    const selected = JSON.stringify(args.select);
    expect(selected).not.toContain("accessToken");
    expect(selected).not.toContain("body");
    expect(selected).not.toContain("credentials");
  });

  it("derives ready, blocked and degraded states and filters them", async () => {
    const ready = makeOrg("o1");
    const blocked = { ...makeOrg("o2"), whatsappAccounts: [] };
    const degraded = {
      ...makeOrg("o3"),
      simulated: false,
      calendarAccount: null,
    };
    prisma.org.findMany.mockResolvedValue([ready, blocked, degraded]);

    expect((await orgsList({ readiness: "all" })).rows.map((row) => row.readiness)).toEqual([
      "degraded",
      "blocked",
      "ready",
    ]);
    expect((await orgsList({ readiness: "ready" })).rows.map((row) => row.id)).toEqual(["o1"]);
    expect((await orgsList({ readiness: "blocked" })).rows.map((row) => row.id)).toEqual(["o2"]);
    expect((await orgsList({ readiness: "degraded" })).rows.map((row) => row.id)).toEqual(["o3"]);
  });

  /**
   * The readiness gate used to read `AgentProfile.businessInfo`, a column no
   * prompt builder has touched since fe85add — so a concierge-onboarded client
   * whose agent had an empty prompt showed "Knowledge configured". It now counts
   * only what the prompt carries: active facts, or active house rules.
   */
  it("flags an org grounded only in the retired Setup blob", async () => {
    const blobOnly = { ...makeOrg("o1"), knowledgeEntries: [], agentRules: [] };
    const ruledOnly = { ...makeOrg("o2"), knowledgeEntries: [] };
    prisma.org.findMany.mockResolvedValue([
      blobOnly,
      { ...ruledOnly, agentRules: [{ id: "rule-o2" }] },
    ]);

    const rows = (await orgsList({ readiness: "all" })).rows;
    const issues = Object.fromEntries(rows.map((row) => [row.id, row.readinessIssues]));
    expect(issues.o1).toContain("Knowledge not configured");
    // An org whose whole knowledge base was instruction-shaped has rules and no
    // facts, and is grounded — the rules ride above the facts in every prompt.
    expect(issues.o2).toEqual([]);
  });

  it("does not read the dead businessInfo column at all", async () => {
    prisma.org.findMany.mockResolvedValue([makeOrg("o1")]);
    await orgsList({});
    const select = prisma.org.findMany.mock.calls.at(-1)![0].select;
    expect(select.agentProfile.select).not.toHaveProperty("businessInfo");
    expect(select.agentRules.where).toEqual({ status: "active" });
  });

  it("flags a paid workspace whose AI has no credits coming", async () => {
    const inactive = { ...makeOrg("o1"), subscriptionStatus: "inactive", currentPeriodEnd: null };
    const lapsed = { ...makeOrg("o2"), currentPeriodEnd: new Date(Date.now() - 86_400_000) };
    const onTrial = {
      ...makeOrg("o3"),
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      trialEndsAt: new Date(Date.now() + 5 * 86_400_000),
    };
    prisma.org.findMany.mockResolvedValue([inactive, lapsed, onTrial]);

    const rows = (await orgsList({ readiness: "all" })).rows;
    const issues = Object.fromEntries(rows.map((row) => [row.id, row.readinessIssues]));
    expect(issues.o1).toContain("Subscription not active: no AI credits");
    expect(issues.o2).toContain("Paid month ended: AI paused until renewed");
    expect(issues.o3).toEqual([]);
  });
});

describe("organization list validation and ordering", () => {
  const row = (id: string, overrides: Partial<OrgRow> = {}): OrgRow => ({
    id,
    name: "Same name",
    plan: "growth",
    simulated: true,
    suspended: false,
    trialEndsAt: null,
    subscriptionStatus: "inactive",
    vertical: "clinic",
    ownerEmail: null,
    numbers: 1,
    contacts: 0,
    members: 1,
    aiCostMicroUsd30d: 0,
    lastInboundAt: null,
    readiness: "ready",
    readinessIssues: [],
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  });

  it("exposes only supported readiness filters and sort orders", () => {
    expect(ORG_READINESS).toEqual(["all", "ready", "blocked", "degraded"]);
    expect(ORG_SORTS).toEqual(["newest", "name", "last_activity", "trial_end", "cost"]);
  });

  it("uses the organization id as a stable sort tie-breaker", () => {
    expect(sortOrgRows([row("o2"), row("o1")], "cost").map((item) => item.id)).toEqual([
      "o1",
      "o2",
    ]);
  });

  it("clamps invalid and out-of-range numeric pages", () => {
    const rows = [row("o1"), row("o2"), row("o3")];
    expect(paginate(rows, -4, 2)).toMatchObject({ page: 1, pageCount: 2, total: 3 });
    expect(paginate(rows, 99, 2)).toMatchObject({
      page: 2,
      pageCount: 2,
      total: 3,
      rows: [rows[2]],
    });
    expect(paginate([], 99, 2)).toEqual({ rows: [], page: 1, pageCount: 1, total: 0 });
  });
});

describe("orgsWhere (org list filters)", () => {
  const now = new Date("2026-09-07T00:00:00Z");
  it("is empty with no filters", () => {
    expect(orgsWhere({}, now)).toEqual({});
  });

  it("search matches id, name, member email and phone-number id", () => {
    const w = orgsWhere({ search: " glow " }, now) as { OR: unknown[] };
    expect(w.OR).toHaveLength(4);
    expect(w.OR[0]).toEqual({ id: "glow" });
  });

  it("combines plan, mode and state with AND", () => {
    const w = orgsWhere({ plan: "front_desk", mode: "live", state: "past_due" }, now) as { AND: unknown[] };
    expect(w.AND).toEqual([
      { plan: "front_desk" },
      { simulated: false },
      { subscriptionStatus: "past_due" },
    ]);
  });

  it("trial states exclude paying orgs; suspended checks the timestamp", () => {
    expect(orgsWhere({ state: "trial" }, now)).toEqual({
      trialEndsAt: { gte: now },
      subscriptionStatus: { not: "active" },
    });
    expect(orgsWhere({ state: "ended_trial" }, now)).toEqual({
      trialEndsAt: { lt: now },
      subscriptionStatus: { not: "active" },
    });
    expect(orgsWhere({ state: "suspended" }, now)).toEqual({ suspendedAt: { not: null } });
  });
});
