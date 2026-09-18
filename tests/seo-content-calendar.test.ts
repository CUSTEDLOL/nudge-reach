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
  return [...text.matchAll(/^### Week (\d+):[^\n]*\n([\s\S]*?)(?=^### Week \d+:|^## |\Z)/gm)].map(
    ([, number, body]) => ({ number: Number(number), body }),
  );
}

describe("four-month SEO and Reddit operating calendar", () => {
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

  it("keeps every later-queue topic planned, not published", () => {
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

  it("sets a manual, transparent, community-specific Reddit safety boundary", () => {
    expect(calendar).toMatch(/check (?:the )?current rules for (?:that|each) community/i);
    expect(calendar).toMatch(/founder of Nudge/i);
    expect(calendar).toMatch(/do not automate (?:Reddit )?posting/i);
    expect(calendar).toMatch(/no unsolicited DMs/i);
    expect(calendar).toMatch(/no vote manipulation/i);
    expect(calendar).toMatch(/no copy-pasted cross-posts/i);
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
