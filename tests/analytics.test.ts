import { describe, expect, it } from "vitest";
import {
  average,
  countDelta,
  dayKeyUTC,
  fillDailyCounts,
  firstResponseGaps,
  formatMinutes,
  formatPct,
  parseRange,
  rateDelta,
  ratio,
  utcDayStart,
  windowFor,
  FIRST_RESPONSE_CAP_MINUTES,
} from "@/lib/analytics/compute";

const NOW = new Date("2026-07-02T10:30:00.000Z");

describe("parseRange", () => {
  it("accepts the three allowed ranges", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("30")).toBe(30);
    expect(parseRange("90")).toBe(90);
  });

  it("falls back to 30 for anything else", () => {
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange("")).toBe(30);
    expect(parseRange("14")).toBe(30);
    expect(parseRange("abc")).toBe(30);
    expect(parseRange("-7")).toBe(30);
  });

  it("takes the first value of an array param", () => {
    expect(parseRange(["7", "90"])).toBe(7);
  });
});

describe("windowFor", () => {
  it("starts the current period at a UTC day boundary including today", () => {
    const { start, end, prevStart } = windowFor(7, NOW);
    expect(start.toISOString()).toBe("2026-06-26T00:00:00.000Z"); // 7 days incl. today
    expect(end).toEqual(NOW);
    expect(prevStart.toISOString()).toBe("2026-06-19T00:00:00.000Z");
  });

  it("previous period has the same length as the current one", () => {
    const { start, prevStart } = windowFor(30, NOW);
    expect(start.getTime() - prevStart.getTime()).toBe(30 * 86_400_000);
  });
});

describe("utcDayStart / dayKeyUTC", () => {
  it("buckets by UTC day", () => {
    expect(utcDayStart(NOW).toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(dayKeyUTC(new Date("2026-07-02T23:59:59.999Z"))).toBe("2026-07-02");
    expect(dayKeyUTC(new Date("2026-07-03T00:00:00.000Z"))).toBe("2026-07-03");
  });
});

describe("fillDailyCounts", () => {
  it("zero-fills every day in the range, in order", () => {
    const series = fillDailyCounts(7, NOW, []);
    expect(series).toHaveLength(7);
    expect(series[0].day).toBe("2026-06-26");
    expect(series[6].day).toBe("2026-07-02");
    expect(series.every((p) => p.inbound === 0 && p.outbound === 0)).toBe(true);
  });

  it("buckets entries into the right UTC day and direction", () => {
    const series = fillDailyCounts(7, NOW, [
      { at: new Date("2026-07-01T05:00:00Z"), direction: "inbound" },
      { at: new Date("2026-07-01T18:00:00Z"), direction: "outbound" },
      { at: new Date("2026-07-01T19:00:00Z"), direction: "outbound" },
      { at: new Date("2026-07-02T01:00:00Z"), direction: "inbound" },
    ]);
    const july1 = series.find((p) => p.day === "2026-07-01")!;
    const july2 = series.find((p) => p.day === "2026-07-02")!;
    expect(july1).toMatchObject({ inbound: 1, outbound: 2 });
    expect(july2).toMatchObject({ inbound: 1, outbound: 0 });
  });

  it("drops entries outside the window instead of misbucketing them", () => {
    const series = fillDailyCounts(7, NOW, [
      { at: new Date("2026-06-01T00:00:00Z"), direction: "inbound" },
    ]);
    expect(series.reduce((s, p) => s + p.inbound + p.outbound, 0)).toBe(0);
  });

  it("labels days in short en-IN format", () => {
    const series = fillDailyCounts(7, NOW, []);
    expect(series[6].label).toMatch(/2 Jul/);
  });
});

describe("firstResponseGaps", () => {
  const msg = (direction: string, iso: string) => ({
    direction,
    createdAt: new Date(iso),
  });

  it("measures from the FIRST inbound of a run to the next outbound", () => {
    const gaps = firstResponseGaps([
      msg("inbound", "2026-07-01T10:00:00Z"),
      msg("inbound", "2026-07-01T10:05:00Z"), // same run — ignored as a start
      msg("outbound", "2026-07-01T10:12:00Z"),
    ]);
    expect(gaps).toEqual([12]);
  });

  it("produces one gap per answered inbound run", () => {
    const gaps = firstResponseGaps([
      msg("inbound", "2026-07-01T10:00:00Z"),
      msg("outbound", "2026-07-01T10:04:00Z"),
      msg("inbound", "2026-07-01T11:00:00Z"),
      msg("outbound", "2026-07-01T11:30:00Z"),
    ]);
    expect(gaps).toEqual([4, 30]);
  });

  it("ignores unanswered inbound runs and outbound-first messages", () => {
    expect(
      firstResponseGaps([
        msg("outbound", "2026-07-01T09:00:00Z"), // proactive — no gap
        msg("inbound", "2026-07-01T10:00:00Z"), // never answered — no gap
      ])
    ).toEqual([]);
  });

  it("caps outlier gaps at 24 hours by default", () => {
    const gaps = firstResponseGaps([
      msg("inbound", "2026-07-01T10:00:00Z"),
      msg("outbound", "2026-07-04T10:00:00Z"), // 3 days later
    ]);
    expect(gaps).toEqual([FIRST_RESPONSE_CAP_MINUTES]);
  });

  it("returns an empty list for an empty conversation", () => {
    expect(firstResponseGaps([])).toEqual([]);
  });
});

describe("average / ratio / formatting", () => {
  it("average returns null for no samples (never fake zeros)", () => {
    expect(average([])).toBeNull();
    expect(average([10, 20])).toBe(15);
  });

  it("ratio returns null on a zero denominator", () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });

  it("formatPct renders honest em-dash when there is no rate", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(0.625)).toBe("63%");
  });

  it("formatMinutes renders human durations", () => {
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(0.4)).toBe("<1m");
    expect(formatMinutes(8.2)).toBe("8m");
    expect(formatMinutes(72)).toBe("1h 12m");
    expect(formatMinutes(120)).toBe("2h");
  });
});

describe("countDelta", () => {
  it("is undefined when both periods are zero", () => {
    expect(countDelta(0, 0, 30)).toBeUndefined();
  });

  it("uses an absolute label when the previous period was zero", () => {
    expect(countDelta(12, 0, 30)).toEqual({
      label: "+12 vs prev 30d",
      direction: "up",
    });
  });

  it("computes % change with direction", () => {
    expect(countDelta(150, 100, 7)).toEqual({
      label: "+50% vs prev 7d",
      direction: "up",
    });
    expect(countDelta(50, 100, 7)).toEqual({
      label: "-50% vs prev 7d",
      direction: "down",
    });
    expect(countDelta(100, 100, 7)?.direction).toBe("neutral");
  });
});

describe("rateDelta", () => {
  it("is undefined when either period has no denominator", () => {
    expect(rateDelta(null, 0.5, 30)).toBeUndefined();
    expect(rateDelta(0.5, null, 30)).toBeUndefined();
  });

  it("reports percentage-point changes", () => {
    expect(rateDelta(0.62, 0.55, 30)).toEqual({
      label: "+7 pts vs prev 30d",
      direction: "up",
    });
    expect(rateDelta(0.5, 0.531, 90)).toEqual({
      label: "-3.1 pts vs prev 90d",
      direction: "down",
    });
    expect(rateDelta(0.4, 0.4, 7)?.direction).toBe("neutral");
  });
});
