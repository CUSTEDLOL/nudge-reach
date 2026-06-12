import { describe, expect, it } from "vitest";
import {
  isForwardTransition,
  simulatedStatusFor,
} from "@/lib/send/sim-progress";

describe("simulatedStatusFor", () => {
  const sentAt = 1_000_000;

  it("is deterministic for the same message id", () => {
    const a = simulatedStatusFor("msg-1", sentAt, sentAt + 30_000);
    const b = simulatedStatusFor("msg-1", sentAt, sentAt + 30_000);
    expect(a).toBe(b);
  });

  it("starts as SENT immediately after sending", () => {
    expect(simulatedStatusFor("msg-1", sentAt, sentAt + 1000)).toBe("SENT");
  });

  it("only ever moves forward over time", () => {
    const order = ["SENT", "DELIVERED", "READ", "CLICKED", "FAILED"];
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) {
      let prevRank = -1;
      for (let t = 0; t <= 40_000; t += 2000) {
        const status = simulatedStatusFor(id, sentAt, sentAt + t);
        const rank = order.indexOf(status);
        expect(rank).toBeGreaterThanOrEqual(prevRank);
        prevRank = rank;
      }
    }
  });

  it("most messages reach DELIVERED or beyond after the timeline", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `bulk-${i}`);
    const final = ids.map((id) =>
      simulatedStatusFor(id, sentAt, sentAt + 60_000)
    );
    const deliveredPlus = final.filter((s) =>
      ["DELIVERED", "READ", "CLICKED"].includes(s)
    ).length;
    expect(deliveredPlus).toBeGreaterThan(75);
    expect(final.some((s) => s === "FAILED")).toBe(true);
  });
});

describe("isForwardTransition", () => {
  it("allows progress, blocks regressions", () => {
    expect(isForwardTransition("QUEUED", "SENT")).toBe(true);
    expect(isForwardTransition("SENT", "DELIVERED")).toBe(true);
    expect(isForwardTransition("DELIVERED", "READ")).toBe(true);
    expect(isForwardTransition("READ", "DELIVERED")).toBe(false);
    expect(isForwardTransition("CLICKED", "SENT")).toBe(false);
  });

  it("FAILED is terminal and unreachable after READ", () => {
    expect(isForwardTransition("FAILED", "SENT")).toBe(false);
    expect(isForwardTransition("READ", "FAILED")).toBe(false);
    expect(isForwardTransition("SENT", "FAILED")).toBe(true);
  });
});
