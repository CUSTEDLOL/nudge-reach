// tests/followup-draft.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, generate, recordSyntheticUsage, envState } = vi.hoisted(() => ({
  envState: { ANTHROPIC_API_KEY: undefined as string | undefined },
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    org: { findUnique: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
  },
  generate: vi.fn(),
  recordSyntheticUsage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage }));

import {
  draftFollowUp,
  draftOffline,
  draftStarterSet,
  parseDraftOutput,
  starterSetOffline,
} from "@/modules/followup/draft";
import { compileFollowUp } from "@/modules/followup/compile";

describe("draftOffline (zero-key simulation path)", () => {
  it("reads the situation and the days out of a sentence", () => {
    const r = draftOffline("chase anyone who goes quiet after 2 days, then again a week later");
    expect(r.situation).toEqual({ kind: "went_quiet", afterDays: 2 });
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1].afterDays).toBe(7);
  });
  it("maps bookings, reviews, new leads and keywords", () => {
    expect(draftOffline("thank people after they book").situation.kind).toBe("booked");
    expect(draftOffline("ask for a review the day after the appointment").messages[0].afterDays).toBe(1);
    expect(draftOffline("welcome every new lead").situation.kind).toBe("new_lead");
    expect(draftOffline('when someone says "price" send our price list').situation).toEqual({
      kind: "keyword",
      keywords: ["price"],
    });
  });
  it("accepts smart quotes around a keyword", () => {
    expect(draftOffline("when someone says “price” send our price list").situation).toEqual({
      kind: "keyword",
      keywords: ["price"],
    });
  });
  it("reads quiet phrasing before booking or keyword words", () => {
    expect(draftOffline("chase leads who asked about pricing but never booked").situation.kind).toBe("went_quiet");
    expect(draftOffline("remind quiet leads to book").situation.kind).toBe("went_quiet");
  });
  it("hears the everyday ways an owner says a lead went quiet", () => {
    expect(draftOffline("chase people who don't reply to my first message").situation.kind).toBe("went_quiet");
    expect(draftOffline("follow up with anyone who has not replied in 3 days").situation).toEqual({
      kind: "went_quiet",
      afterDays: 3,
    });
  });
  it("never claims a visit happened: the review ask is timed from the booking", () => {
    const r = draftOffline("ask for a review the day after the appointment");
    expect(r.situation.kind).toBe("booked");
    expect(r.messages[0].header).toBe("How did it go?");
    expect(r.messages[0].body).not.toMatch(/coming in/);
    expect(r.messages[0].footer).toContain("STOP");
  });
  it("welcomes a new lead with the shared welcome copy and a STOP footer", () => {
    const r = draftOffline("welcome every new lead");
    expect(r.messages[0].header).toBe("Thanks for reaching out");
    expect(r.messages[0].footer).toContain("STOP");
  });
  it("falls back to a 2-day quiet chase for anything else", () => {
    expect(draftOffline("something").situation).toEqual({ kind: "went_quiet", afterDays: 2 });
  });
});

describe("starterSetOffline", () => {
  it("yields three valid, compilable follow-ups timed from the booking", () => {
    const set = starterSetOffline();
    expect(set.map((s) => s.name)).toEqual(["Quiet-lead chase", "Booking confirmed", "Welcome new leads"]);
    for (const s of set) expect(() => compileFollowUp(s)).not.toThrow();
    const booked = set[1];
    expect(booked.situation.kind).toBe("booked");
    expect(booked.stopOn).toEqual(["booking"]);
    expect(booked.messages[0].afterDays).toBe(0);
    expect(booked.messages[0].body).not.toMatch(/tomorrow|coming in/);
    expect(set[2].messages[0].header).toBe("Thanks for reaching out");
    expect(set[2].messages[0].footer).toContain("STOP");
  });
});

describe("parseDraftOutput", () => {
  it("accepts a fenced single follow-up and repairs it", () => {
    const r = parseDraftOutput(
      '```json\n{"followUp":{"name":"Chase","situation":{"kind":"went_quiet","afterDays":3},"messages":[{"afterDays":0,"category":"MARKETING","header":"Hi","body":"Still there?","footer":""}]}}\n```',
      "single"
    );
    expect(r.ok && r.specs[0].messages[0].body).toContain("{{1}}");
  });
  it("takes the first entry when a single draft comes back as a list", () => {
    const r = parseDraftOutput(
      '{"followUps":[{"name":"First","situation":{"kind":"new_lead"},"messages":[{"afterDays":0,"category":"MARKETING","header":"Hi","body":"Hi {{1}}","footer":""}]}]}',
      "single"
    );
    expect(r.ok && r.specs.map((s) => s.name)).toEqual(["First"]);
  });
  it("accepts a starter set and drops the invalid entries", () => {
    const r = parseDraftOutput(
      '{"followUps":[{"name":"ok","situation":{"kind":"booked"},"messages":[{"afterDays":1,"category":"UTILITY","header":"See you","body":"Hi {{1}}","footer":""}]},{"name":"bad","situation":{"kind":"nope"},"messages":[]}]}',
      "set"
    );
    expect(r.ok && r.specs.map((s) => s.name)).toEqual(["ok"]);
  });
  it("fails cleanly on non-JSON", () => {
    expect(parseDraftOutput("sorry, I can't", "single").ok).toBe(false);
  });
});

describe("draftFollowUp / draftStarterSet without a key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never calls the model and still meters a synthetic row", async () => {
    const spec = await draftFollowUp({ orgId: "o1", request: "welcome every new lead" });
    expect(spec.situation.kind).toBe("new_lead");
    expect(generate).not.toHaveBeenCalled();
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "o1", purpose: "followup_draft" },
      "welcome every new lead",
      expect.any(String)
    );
  });
  it("writes the offline starter set and meters a synthetic row", async () => {
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set).toHaveLength(3);
    expect(generate).not.toHaveBeenCalled();
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "o1", purpose: "followup_draft" },
      "starter set",
      expect.any(String)
    );
  });
  it("refuses an empty sentence", async () => {
    await expect(draftFollowUp({ orgId: "o1", request: "   " })).rejects.toThrow(
      "Describe the follow-up in a sentence first."
    );
  });

  // The founder's concierge drafting is absorbed (Nudge pays); the client's own
  // drafting stays `followup_draft` and comes out of their credits.
  it("meters the caller's purpose when one is given", async () => {
    await draftFollowUp({ orgId: "o1", request: "welcome every new lead", purpose: "concierge_draft" });
    expect(recordSyntheticUsage).toHaveBeenLastCalledWith(
      { orgId: "o1", purpose: "concierge_draft" },
      "welcome every new lead",
      expect.any(String)
    );
    await draftStarterSet({ orgId: "o1", purpose: "concierge_draft" });
    expect(recordSyntheticUsage).toHaveBeenLastCalledWith(
      { orgId: "o1", purpose: "concierge_draft" },
      "starter set",
      expect.any(String)
    );
  });
});

const VALID_SINGLE = {
  name: "Chase",
  situation: { kind: "went_quiet", afterDays: 3 },
  messages: [{ afterDays: 0, category: "MARKETING", header: "Hi", body: "Still there {{1}}?", footer: "" }],
};
const VALID_BOOKED = {
  name: "See you",
  situation: { kind: "booked" },
  messages: [{ afterDays: 1, category: "UTILITY", header: "See you", body: "Hi {{1}}", footer: "" }],
};
const PROFILE = {
  businessName: "Glow Clinic",
  vertical: "clinic",
  businessInfo: "Hair transplant consults.",
  tone: "Warm",
  doNots: "",
};

describe("draft with a key (model path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.ANTHROPIC_API_KEY = "test-key";
    prisma.agentProfile.findUnique.mockResolvedValue(PROFILE);
    prisma.org.findUnique.mockResolvedValue({ name: "Glow", vertical: "clinic" });
    prisma.knowledgeEntry.findMany.mockResolvedValue([
      { category: "pricing", fact: "Consults are ₹500", condition: null },
    ]);
  });
  afterEach(() => {
    envState.ANTHROPIC_API_KEY = undefined;
  });

  it("retries once on prose, attributes both calls, and returns the parsed spec", async () => {
    generate
      .mockResolvedValueOnce("Sure! Here is a follow-up for you.")
      .mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    const spec = await draftFollowUp({ orgId: "o1", request: "chase quiet leads after 3 days" });
    expect(spec.name).toBe("Chase");
    expect(spec.messages[0].footer).toContain("STOP");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0].prompt).toContain("IMPORTANT");
    for (const [call] of generate.mock.calls) {
      expect(call.attribution).toEqual({ orgId: "o1", purpose: "followup_draft" });
    }
  });

  it("carries the caller's purpose into the model call's attribution", async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads", purpose: "concierge_draft" });
    expect(generate.mock.calls[0][0].attribution).toEqual({ orgId: "o1", purpose: "concierge_draft" });

    generate.mockResolvedValueOnce(JSON.stringify({ followUps: [VALID_SINGLE, VALID_BOOKED] }));
    await draftStarterSet({ orgId: "o1", purpose: "concierge_draft" });
    expect(generate.mock.calls[1][0].attribution).toEqual({ orgId: "o1", purpose: "concierge_draft" });
  });

  it("grounds the system prompt in the business, its active knowledge and the rules", async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    expect(prisma.knowledgeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "o1", status: "active" },
        orderBy: { createdAt: "asc" },
      })
    );
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("Glow Clinic");
    expect(system).toContain("clinic business");
    expect(system).toContain("Hair transplant consults.");
    expect(system).toContain("Consults are ₹500");
    expect(system).toContain("booked situations omit it");
    expect(system).toContain("never write 'tomorrow'");
    expect(system).toContain("unless it appears in the business information below");
    expect(system).not.toContain("know nothing");
    // Blank-line separators survive the conditional-line filter.
    expect(system).toContain("\n\nSituations (use exactly these kinds):");
  });

  it("lists the owner's do-nots as a Never line", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, doNots: "promise results" });
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    expect(generate.mock.calls[0][0].system).toContain("- Never: promise results");
  });

  it("tells the model it knows nothing when there is no business info or knowledge", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, businessInfo: "" });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("know nothing");
    expect(system).not.toContain("About the business:");
  });

  it("treats a whitespace-only profile as knowing nothing", async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ ...PROFILE, businessInfo: "   \n  " });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    generate.mockResolvedValueOnce(JSON.stringify({ followUp: VALID_SINGLE }));
    await draftFollowUp({ orgId: "o1", request: "chase quiet leads" });
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain("know nothing");
    expect(system).not.toContain("About the business:");
  });

  it("gives up with a friendly error after two bad replies, logging only the reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      generate.mockResolvedValue("no json here");
      await expect(draftFollowUp({ orgId: "o1", request: "chase quiet leads" })).rejects.toThrow(
        "We couldn't write that follow-up just now"
      );
      expect(generate).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith("[followup-draft] unusable model output", {
        orgId: "o1",
        mode: "single",
        error: expect.any(String),
      });
    } finally {
      warn.mockRestore();
    }
  });

  it("shows the set the object shape and keeps the valid entries", async () => {
    generate.mockResolvedValueOnce(
      JSON.stringify({ followUps: [VALID_BOOKED, { name: "bad", situation: { kind: "nope" }, messages: [] }] })
    );
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set.map((s) => s.name)).toEqual(["See you"]);
    expect(set[0].stopOn).toEqual(["booking"]);
    const { prompt, maxTokens } = generate.mock.calls[0][0];
    expect(maxTokens).toBe(4000);
    expect(prompt).toContain('"situation"');
    expect(prompt).toContain('"messages"');
  });

  it("returns all six of a full set, with STOP footers on the marketing ones", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...VALID_SINGLE, name: `Chase ${i + 1}` }));
    generate.mockResolvedValueOnce(JSON.stringify({ followUps: six }));
    const set = await draftStarterSet({ orgId: "o1" });
    expect(set).toHaveLength(6);
    for (const s of set) expect(s.messages[0].footer).toContain("STOP");
  });
});
