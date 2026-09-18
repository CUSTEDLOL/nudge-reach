import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calendarPath = "docs/SEO_CONTENT_CALENDAR.md";
const calendar = existsSync(calendarPath)
  ? readFileSync(calendarPath, "utf8")
  : "";

const laterQueue = [
  "AI replies for WhatsApp Business",
  "WhatsApp lead follow-up automation",
  "WhatsApp AI lead qualification",
  "WhatsApp AI lead generation: what it can and cannot do",
  "WhatsApp Business App vs Cloud API vs AI automation",
  "Official API vs unofficial WhatsApp automation",
  "WhatsApp AI automation for restaurants",
  "WhatsApp AI automation examples for small businesses",
  "WhatsApp automation readiness checker",
  "WhatsApp 24-hour window and template checker",
];

function weekSections(text: string) {
  return [...text.matchAll(/^### Week (\d+):[^\n]*\n([\s\S]*?)(?=^### Week \d+:|^## |(?![\s\S]))/gm)].map(
    ([, number, body]) => ({ number: Number(number), body }),
  );
}

describe("four-month SEO and Reddit operating calendar", () => {
  it("parses a final week at the real end of the string", () => {
    expect(weekSections("### Week 1: Final\n- **Website action:** Review it.")).toEqual([
      { number: 1, body: "- **Website action:** Review it." },
    ]);
  });

  it("exists and contains exactly 16 sequential numbered weeks", () => {
    expect(existsSync(calendarPath)).toBe(true);

    const weeks = weekSections(calendar);
    expect(weeks).toHaveLength(16);
    expect(weeks.map(({ number }) => number)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
  });

  it("gives every week one founder-operable website action, native Reddit action, measurement, and owner", () => {
    for (const week of weekSections(calendar)) {
      expect(week.body).toMatch(/^- \*\*Website action:\*\* .+/m);
      expect(week.body).toMatch(/^- \*\*Manual Reddit action:\*\* .+/m);
      expect(week.body).toMatch(/^- \*\*Manual Reddit action:\*\*.*\bnative(?:ly)?\b/im);
      expect(week.body).toMatch(/^- \*\*Measurement:\*\* .+/m);
      expect(week.body).toMatch(/^- \*\*Owner:\*\* .+/m);
    }
  });

  it("does not duplicate a weekly Reddit action string", () => {
    const actions = weekSections(calendar).map((week) =>
      week.body.match(/^- \*\*Manual Reddit action:\*\* (.+)$/m)?.[1],
    );

    expect(actions).toHaveLength(16);
    expect(actions.every(Boolean)).toBe(true);
    expect(new Set(actions).size).toBe(16);
  });

  it("labels every later-queue topic Planned", () => {
    for (const topic of laterQueue) {
      expect(calendar).toContain(`Planned: ${topic}`);
    }
  });

  it("puts explicit Search Console reviews in weeks 4, 8, 12, and 16", () => {
    const weeks = new Map(
      weekSections(calendar).map(({ number, body }) => [number, body]),
    );

    for (const weekNumber of [4, 8, 12, 16]) {
      expect(weeks.get(weekNumber)).toMatch(/Search Console review/i);
    }
  });

  it("schedules the approved Month 2 and Month 3 publication cadence as future work", () => {
    const weeks = new Map(
      weekSections(calendar).map(({ number, body }) => [number, body]),
    );

    expect(weeks.get(5)).toMatch(/planned future publication.*AI replies for WhatsApp Business/i);
    expect(weeks.get(6)).toMatch(/planned future publication.*WhatsApp lead follow-up automation/i);
    expect(weeks.get(7)).toMatch(/planned future publication.*WhatsApp AI lead qualification/i);
    expect(weeks.get(9)).toMatch(/build.*WhatsApp 24-hour window and template checker/i);
    expect(weeks.get(10)).toMatch(/planned future publication.*WhatsApp Business App vs Cloud API vs AI automation/i);
    expect(weeks.get(11)).toMatch(/planned future publication.*WhatsApp AI automation for restaurants/i);
    expect(weeks.get(15)).toMatch(/planned future publication.*Official API vs unofficial WhatsApp automation/i);
  });

  it("uses distinct-intent and Search Console checks before publishing guides near the lead-loss guide", () => {
    const weeks = new Map(
      weekSections(calendar).map(({ number, body }) => [number, body]),
    );

    for (const weekNumber of [6, 7]) {
      expect(weeks.get(weekNumber)).toMatch(/distinct-intent brief/i);
      expect(weeks.get(weekNumber)).toMatch(/Search Console.*lead-loss guide/i);
      expect(weeks.get(weekNumber)).toMatch(/update or consolidate the existing lead-loss guide/i);
    }
  });

  it("measures the service-window checker against its own intent", () => {
    const week9 = weekSections(calendar).find(({ number }) => number === 9)?.body;

    expect(week9).toMatch(/Search Console.*24-hour service window.*template/i);
    expect(week9).toMatch(/aggregate.*service-window.*template.*questions/i);
    expect(week9).toMatch(/checker interactions.*UNKNOWN/i);
    expect(week9).toMatch(/attributable demos.*UNKNOWN/i);
  });

  it("keeps draft-only Week 13 focused on editorial readiness, not public engagement", () => {
    const week13 = weekSections(calendar).find(({ number }) => number === 13)?.body;

    expect(week13).toMatch(/editorial differentiation and readiness/i);
    expect(week13).toMatch(/defer engagement measurement until publication/i);
  });

  it("marks privacy-gated engagement and attribution metrics UNKNOWN until the SEO operations gates are active", () => {
    expect(calendar).toContain("docs/SEO_OPERATIONS.md");
    expect(calendar).toMatch(/calculator starts.*UNKNOWN/i);
    expect(calendar).toMatch(/page engagement.*UNKNOWN/i);
    expect(calendar).toMatch(/attribution.*UNKNOWN/i);
    expect(calendar).toMatch(/referral quality.*UNKNOWN/i);
    expect(calendar).toMatch(/privacy-approved aggregate event.*inactive/i);
  });

  it("sets a manual, transparent, community-specific Reddit safety boundary", () => {
    expect(calendar).toMatch(/check (?:the )?current rules for (?:that|each) community/i);
    expect(calendar).toMatch(/founder of Nudge/i);
    expect(calendar).toMatch(/do not automate (?:Reddit )?posting/i);
    expect(calendar).toMatch(/no unsolicited DMs/i);
    expect(calendar).toMatch(/no vote manipulation/i);
    expect(calendar).toMatch(/no copy-pasted cross-posts/i);
    expect(calendar).toMatch(/idea queue.*not a posting quota/i);
    expect(calendar).toMatch(/skip Reddit that week if there is no genuinely relevant discussion or permitted community fit/i);
  });

  it("includes a reusable preflight, privacy-safe UTM convention, and official policy sources", () => {
    expect(calendar).toContain("## Reddit preflight checklist");
    expect(calendar).toContain("utm_source=reddit");
    expect(calendar).toContain("utm_medium=founder_organic");
    expect(calendar).toMatch(/no usernames, post IDs, community names, or personal data/i);
    expect(calendar).toContain(
      "https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam",
    );
    expect(calendar).toContain(
      "https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities",
    );
    expect(calendar).toContain(
      "https://support.reddithelp.com/hc/en-us/articles/360043512931-Don-t-break-the-site",
    );
  });

  it("preserves AI Front Desk and WhatsApp compliance positioning", () => {
    expect(calendar).toContain("AI Front Desk");
    expect(calendar).toContain("official Meta Cloud API");
    expect(calendar).toMatch(/opted-in recipients/i);
    expect(calendar).toContain("STOP");
    expect(calendar).toContain("24-hour service window");
    expect(calendar).toMatch(/approved templates/i);
  });
});
