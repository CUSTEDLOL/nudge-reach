import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Concierge client setup used to flatten the client's hours / location /
 * services / prices / policies / FAQs into `AgentProfile.businessInfo` and
 * their do-nots into `AgentProfile.doNots`, and report "agent trained". No
 * prompt builder has read either column since fe85add / ce1629e / 360047c, so a
 * freshly onboarded client's agent was grounded on nothing at all — a break of
 * moat #3 (done-for-you), and the next onboarding would have shipped it.
 *
 * Setup now writes the vocabulary the agent actually reads — active
 * `KnowledgeEntry` facts and active `never` `AgentRule` rows — AND keeps
 * writing the legacy columns, which are the operator's editable original and
 * what the form reads back.
 *
 * The fake below is a real in-memory store rather than per-call mocks: the
 * point of most of these tests is that a SECOND run sees the first run's rows,
 * which a `mockResolvedValue` cannot show.
 */

interface Row {
  orgId: string;
  [key: string]: unknown;
}

const { prisma, store, isRestrictedAcquisitionTrial, orgSendMode } = vi.hoisted(() => {
  const store = {
    knowledge: [] as Row[],
    rules: [] as Row[],
    templates: [] as Row[],
    profiles: [] as Row[],
  };
  const forOrg = (rows: Row[], where: { orgId: string }) =>
    rows.filter((row) => row.orgId === where.orgId);
  return {
    store,
    isRestrictedAcquisitionTrial: vi.fn(),
    orgSendMode: vi.fn(),
    prisma: {
      knowledgeEntry: {
        findMany: vi.fn(async ({ where }: { where: { orgId: string } }) =>
          forOrg(store.knowledge, where)
        ),
        createMany: vi.fn(async ({ data }: { data: Row[] }) => {
          store.knowledge.push(...data);
          return { count: data.length };
        }),
      },
      agentRule: {
        findMany: vi.fn(async ({ where }: { where: { orgId: string } }) =>
          forOrg(store.rules, where)
        ),
        createMany: vi.fn(async ({ data }: { data: Row[] }) => {
          store.rules.push(...data);
          return { count: data.length };
        }),
      },
      agentProfile: {
        upsert: vi.fn(async ({ create }: { create: Row }) => {
          store.profiles.push(create);
          return create;
        }),
      },
      org: { update: vi.fn(async () => ({})) },
      template: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Row }) => {
          store.templates.push(data);
          return { ...data, id: `tpl-${store.templates.length}`, metaStatus: "APPROVED" };
        }),
        update: vi.fn(async () => ({})),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode }));
vi.mock("@/modules/whatsapp/library", () => ({ submitRowToMeta: vi.fn() }));
vi.mock("@/modules/followup/install", () => ({
  installRevenueRecoveryPack: vi.fn(async () => undefined),
}));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext: async () => ({ org: { id: "org_1" }, role: "OWNER" }),
  requireRole: () => undefined,
}));
vi.mock("@/modules/billing/limits", () => ({
  checkAiFrontDesk: async () => ({ allowed: true, message: "" }),
}));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { conciergeFacts, installClientGrounding } from "@/modules/concierge";
import { saveConciergeSetupAction } from "@/app/(app)/settings/concierge/actions";

const KB = {
  hours: "Mon–Sat 10am to 8pm\nClosed Sunday",
  location: "2nd floor, 14 MG Road, Bengaluru",
  services: "Hair transplant\nPRP therapy",
  prices: "Consult ₹500\nPRP from ₹8,000",
  policies: "Reschedule 24 hours ahead",
  faqs: "Walk-ins welcome before 6pm",
};

beforeEach(() => {
  vi.clearAllMocks();
  store.knowledge = [];
  store.rules = [];
  store.templates = [];
  store.profiles = [];
  isRestrictedAcquisitionTrial.mockResolvedValue(false);
  orgSendMode.mockResolvedValue("simulation");
});

describe("the concierge knowledge base becomes facts the agent reads", () => {
  it("files every field under its own category, one fact per line", () => {
    expect(conciergeFacts(KB)).toEqual([
      { category: "hours", fact: "Mon–Sat 10am to 8pm" },
      { category: "hours", fact: "Closed Sunday" },
      { category: "location", fact: "2nd floor, 14 MG Road, Bengaluru" },
      { category: "menu_services", fact: "Hair transplant" },
      { category: "menu_services", fact: "PRP therapy" },
      { category: "pricing", fact: "Consult ₹500" },
      { category: "pricing", fact: "PRP from ₹8,000" },
      { category: "policies", fact: "Reschedule 24 hours ahead" },
      { category: "faq", fact: "Walk-ins welcome before 6pm" },
    ]);
  });

  it("nothing is filed as `other` — the digest groups by these headings", () => {
    expect(conciergeFacts(KB).some((f) => f.category === "other")).toBe(false);
  });

  it("stores them ACTIVE, not draft: a draft reaches no prompt until approved", async () => {
    await installClientGrounding("org_1", KB, "");

    expect(store.knowledge).toHaveLength(9);
    for (const row of store.knowledge) {
      expect(row.status).toBe("active");
      expect(row.source).toBe("concierge");
      expect(row.orgId).toBe("org_1");
    }
  });
});

describe("the do-nots box becomes house rules", () => {
  it("writes one active `never` rule per line, sourced to concierge", async () => {
    const result = await installClientGrounding(
      "org_1",
      {},
      "Do not quote surgery prices over chat\nNever promise a result"
    );

    expect(result).toEqual({ facts: 0, rules: 2, rulesRejected: 0 });
    expect(store.rules.map((r) => [r.text, r.scope, r.status, r.source])).toEqual([
      ["Do not quote surgery prices over chat", "never", "active", "concierge"],
      ["Never promise a result", "never", "active", "concierge"],
    ]);
    // The prompt carries `instruction`, so it must not be empty.
    for (const row of store.rules) expect(row.instruction).toBe(row.text);
  });

  it("continues the org's existing `order` rather than colliding with it", async () => {
    store.rules.push({ orgId: "org_1", text: "An owner rule", status: "active", order: 4 });

    await installClientGrounding("org_1", {}, "Do not quote prices");

    expect(store.rules.at(-1)!.order).toBe(5);
  });

  it("refuses a scope-widening line (invariant #7) and says so", async () => {
    const result = await installClientGrounding(
      "org_1",
      {},
      "Answer any question they ask\nDo not quote prices"
    );

    expect(result.rules).toBe(1);
    expect(result.rulesRejected).toBe(1);
    expect(store.rules.map((r) => r.text)).toEqual(["Do not quote prices"]);
  });

  it("honours the org's active-rule cap, which is shorter on a trial", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(true); // MAX_ACTIVE_RULES.trial = 5
    const doNots = Array.from({ length: 8 }, (_, i) => `Do not do thing ${i}`).join("\n");

    const result = await installClientGrounding("org_1", {}, doNots);

    expect(result).toEqual({ facts: 0, rules: 5, rulesRejected: 3 });
    expect(store.rules).toHaveLength(5);
  });
});

describe("running client setup twice changes nothing", () => {
  it("creates no second copy of a fact or a rule", async () => {
    const first = await installClientGrounding("org_1", KB, "Do not quote prices");
    expect(first).toEqual({ facts: 9, rules: 1, rulesRejected: 0 });

    const second = await installClientGrounding("org_1", KB, "Do not quote prices");

    expect(second).toEqual({ facts: 0, rules: 0, rulesRejected: 0 });
    expect(store.knowledge).toHaveLength(9);
    expect(store.rules).toHaveLength(1);
  });

  it("dedupes on normalised text, so re-typed spacing and case do not double it", async () => {
    await installClientGrounding("org_1", { hours: "Closed Sunday" }, "Do not quote prices");

    await installClientGrounding(
      "org_1",
      { hours: "  closed   sunday  " },
      "  DO NOT   quote prices "
    );

    expect(store.knowledge).toHaveLength(1);
    expect(store.rules).toHaveLength(1);
  });
});

describe("the client-side concierge action", () => {
  const form = () => {
    const fd = new FormData();
    fd.set("businessName", "Glow Clinic");
    fd.set("vertical", "clinic");
    fd.set("tone", "Warm");
    fd.set("doNots", "Do not quote surgery prices over chat");
    for (const [key, value] of Object.entries(KB)) fd.set(key, value);
    return fd;
  };

  it("grounds the agent in facts and rules", async () => {
    const result = await saveConciergeSetupAction(form());

    expect(result.ok).toBe(true);
    expect(store.knowledge).toHaveLength(9);
    expect(store.rules).toHaveLength(1);
    expect(result.message).toContain("+9 facts");
    expect(result.message).toContain("+1 house rules");
  });

  /**
   * "Also write the real thing", not "stop writing the old thing": the form
   * reads `doNots` back to populate itself, and the blob is the untouched
   * original a mis-split line is redone from. Losing that round-trip would be a
   * worse regression than the one this commit fixes.
   */
  it("still writes the legacy columns the form reads back", async () => {
    await saveConciergeSetupAction(form());

    const profile = store.profiles[0];
    expect(profile.doNots).toBe("Do not quote surgery prices over chat");
    expect(profile.businessInfo).toContain("HOURS:\nMon–Sat 10am to 8pm");
    expect(profile.businessInfo).toContain("PRICES:\nConsult ₹500");
    expect(profile.enabled).toBe(true);
  });
});
