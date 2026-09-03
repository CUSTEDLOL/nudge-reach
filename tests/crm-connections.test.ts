import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "s", TOKEN_ENCRYPTION_KEY: "k".repeat(40) },
}));
const rows = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("@/lib/db", () => ({
  prisma: {
    crmConnection: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        const row = { id: "cc1", ...create };
        rows.set("cc1", row);
        return row;
      }),
      findUniqueOrThrow: vi.fn(async () => rows.get("cc1")),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        rows.set("cc1", { ...rows.get("cc1")!, ...data });
        return rows.get("cc1");
      }),
    },
  },
}));
const refresh = vi.hoisted(() => vi.fn(async () => ({ accessToken: "new-access", expiresInSecs: 3600 })));
vi.mock("@/modules/crm/providers/zoho", () => ({ zohoProvider: { key: "zoho", refresh } }));

import { providerFor, saveConnection, withAccessToken } from "@/modules/crm/connections";
import { simulationProvider } from "@/modules/crm/providers/simulation";

describe("connections", () => {
  it("uses the simulation provider for simulated orgs or missing keys", () => {
    expect(providerFor("zoho", { simulated: true })).toBe(simulationProvider);
    expect(providerFor("salesforce", { simulated: false })).toBe(simulationProvider); // no SALESFORCE keys
    expect(providerFor("zoho", { simulated: false }).key).toBe("zoho");
  });
  it("stores tokens encrypted and refreshes an expired access token", async () => {
    await saveConnection(
      "org1",
      "zoho",
      { accessToken: "old", refreshToken: "r", expiresInSecs: -10, apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accountLabel: "Zoho" },
      false
    );
    const stored = rows.get("cc1")!;
    expect(String(stored.refreshTokenEncrypted)).not.toBe("r");
    expect(String(stored.refreshTokenEncrypted).split(".")).toHaveLength(3);
    const conn = await withAccessToken("cc1");
    expect(refresh).toHaveBeenCalledWith({ refreshToken: "r", accountsServer: "https://accounts.zoho.in" });
    expect(conn.accessToken).toBe("new-access");
    expect(conn.apiDomain).toBe("https://www.zohoapis.in");
  });
});
