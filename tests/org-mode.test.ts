import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "live" } }));

import { isSimulated, sendModeFor } from "@/modules/orgs/mode";

describe("per-org test mode (live deployment)", () => {
  it("a fresh org is mocked until its number is connected", () => {
    expect(sendModeFor({ simulated: true })).toBe("simulation");
    expect(isSimulated({ simulated: true })).toBe(true);
  });

  it("a connected org sends for real", () => {
    expect(sendModeFor({ simulated: false })).toBe("live");
    expect(isSimulated({ simulated: false })).toBe(false);
  });
});
