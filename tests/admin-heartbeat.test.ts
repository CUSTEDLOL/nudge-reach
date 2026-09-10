import { describe, expect, it } from "vitest";
import {
  boundedCount,
  classifyHeartbeat,
  highestSeverity,
} from "@/modules/admin/health";

const minutesAgo = (minutes: number, now: Date) =>
  new Date(now.getTime() - minutes * 60_000);

describe("founder ops heartbeat", () => {
  const now = new Date("2026-09-09T10:00:00Z");

  it("classifies explicit freshness thresholds", () => {
    expect(classifyHeartbeat(minutesAgo(4, now), now)).toBe("healthy");
    expect(classifyHeartbeat(minutesAgo(12, now), now)).toBe("degraded");
    expect(classifyHeartbeat(minutesAgo(31, now), now)).toBe("critical");
    expect(classifyHeartbeat(null, now)).toBe("unknown");
  });

  it("keeps critical above degraded above healthy", () => {
    expect(highestSeverity(["healthy", "degraded"])).toBe("degraded");
    expect(highestSeverity(["degraded", "critical", "healthy"])).toBe("critical");
  });

  it("bounds persisted counter details", () => {
    expect(boundedCount(-10)).toBe(0);
    expect(boundedCount(4.9)).toBe(4);
    expect(boundedCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(boundedCount(9_999_999_999)).toBe(1_000_000);
  });
});
