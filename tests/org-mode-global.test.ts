import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation" } }));

import { sendModeFor } from "@/modules/orgs/mode";

describe("global SEND_MODE=simulation (invariant #4)", () => {
  it("mocks every org, even one flagged live", () => {
    expect(sendModeFor({ simulated: false })).toBe("simulation");
    expect(sendModeFor({ simulated: true })).toBe("simulation");
  });
});
