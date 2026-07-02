import { describe, expect, it } from "vitest";
import { buildContactWhere, parseSegmentFilter } from "@/lib/segments";

describe("buildContactWhere (dynamic segments — M3/M4 contract)", () => {
  it("always scopes to the org, even with an empty filter", () => {
    expect(buildContactWhere("org-1", {})).toEqual({ orgId: "org-1" });
  });

  it("filters by lead stage", () => {
    expect(buildContactWhere("org-1", { stage: "WON" })).toMatchObject({
      orgId: "org-1",
      leadStage: "WON",
    });
  });

  it("filters by tag via the ContactTag join", () => {
    expect(buildContactWhere("org-1", { tagId: "tag-9" })).toMatchObject({
      tags: { some: { tagId: "tag-9" } },
    });
  });

  it("optedIn=true also requires optedOutAt null (consent semantics)", () => {
    const where = buildContactWhere("org-1", { optedIn: true });
    expect(where.optedIn).toBe(true);
    expect(where.optedOutAt).toBeNull();
  });

  it("optedIn=false does NOT add the optedOutAt clause", () => {
    const where = buildContactWhere("org-1", { optedIn: false });
    expect(where.optedIn).toBe(false);
    expect("optedOutAt" in where).toBe(false);
  });

  it("filters by source and assignee", () => {
    expect(
      buildContactWhere("org-1", { source: "csv_import", assignedToUserId: "u1" })
    ).toMatchObject({ optInSource: "csv_import", assignedToUserId: "u1" });
  });

  it('maps the "unassigned" sentinel to assignedToUserId null', () => {
    const where = buildContactWhere("org-1", {
      assignedToUserId: "unassigned",
    });
    expect(where.assignedToUserId).toBeNull();
  });

  it("free-text q searches name, phone and email", () => {
    const where = buildContactWhere("org-1", { q: "priya" });
    expect(where.OR).toEqual([
      { name: { contains: "priya", mode: "insensitive" } },
      { phoneE164: { contains: "priya" } },
      { email: { contains: "priya", mode: "insensitive" } },
    ]);
  });
});

describe("parseSegmentFilter (URL params → SegmentFilter)", () => {
  it("parses a full set of valid params", () => {
    expect(
      parseSegmentFilter({
        stage: "QUALIFIED",
        tag: "tag-1",
        optin: "yes",
        assignee: "user-1",
        source: "in_store",
        q: "priya",
      })
    ).toEqual({
      stage: "QUALIFIED",
      tagId: "tag-1",
      optedIn: true,
      assignedToUserId: "user-1",
      source: "in_store",
      q: "priya",
    });
  });

  it("drops an invalid stage instead of building a bad query", () => {
    expect(parseSegmentFilter({ stage: "MEGA_WON" })).toEqual({});
  });

  it('optin "no" means optedIn=false; junk is ignored', () => {
    expect(parseSegmentFilter({ optin: "no" })).toEqual({ optedIn: false });
    expect(parseSegmentFilter({ optin: "maybe" })).toEqual({});
  });

  it("ignores empty strings and array values", () => {
    expect(
      parseSegmentFilter({ stage: "", tag: ["a", "b"], q: undefined })
    ).toEqual({});
  });

  it("passes the unassigned sentinel through", () => {
    expect(parseSegmentFilter({ assignee: "unassigned" })).toEqual({
      assignedToUserId: "unassigned",
    });
  });

  it("caps runaway q input at 100 chars", () => {
    const q = "x".repeat(500);
    expect(parseSegmentFilter({ q })?.q).toHaveLength(100);
  });
});
