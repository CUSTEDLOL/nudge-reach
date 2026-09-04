import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", TOKEN_ENCRYPTION_KEY: "k".repeat(40), NEXT_PUBLIC_APP_URL: "https://nudgeagent.app", ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "s" },
}));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext: vi.fn(async () => ({ org: { id: "org1", simulated: false }, role: "OWNER", userId: "u", email: "e" })),
  requireRole: vi.fn(),
}));
const saveConnection = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/modules/crm/connections", async (orig) => ({
  ...(await orig<typeof import("@/modules/crm/connections")>()),
  saveConnection,
}));
vi.mock("@/lib/db", () => ({ prisma: { org: { findUnique: vi.fn(async () => ({ id: "org1", simulated: false })) } } }));
vi.mock("@/modules/crm/providers/zoho", () => ({
  zohoProvider: {
    key: "zoho",
    authUrl: () => "https://accounts.zoho.in/oauth/v2/auth?x=1",
    exchangeCode: vi.fn(async () => ({
      accessToken: "a", refreshToken: "r", expiresInSecs: 3600, apiDomain: "https://www.zohoapis.in", accountsServer: "https://accounts.zoho.in", accountLabel: "Zoho",
    })),
  },
}));

import { GET as start } from "@/app/api/integrations/crm/[provider]/start/route";
import { GET as callback } from "@/app/api/integrations/crm/[provider]/callback/route";
import { signState } from "@/modules/crm/oauth-state";

describe("crm oauth routes", () => {
  it("start redirects to the provider", async () => {
    const res = await start(new Request("http://localhost/api/integrations/crm/zoho/start"), { params: Promise.resolve({ provider: "zoho" }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("accounts.zoho.in");
  });
  it("callback verifies state, exchanges the code and stores the connection", async () => {
    const state = signState("org1", "zoho", "k".repeat(40));
    const res = await callback(
      new Request(`http://localhost/api/integrations/crm/zoho/callback?code=abc&state=${state}&location=in&accounts-server=https%3A%2F%2Faccounts.zoho.in`),
      { params: Promise.resolve({ provider: "zoho" }) }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/integrations?crm=connected");
    expect(saveConnection).toHaveBeenCalledWith("org1", "zoho", expect.objectContaining({ apiDomain: "https://www.zohoapis.in" }), false);
  });
  it("callback rejects a forged state", async () => {
    const res = await callback(new Request("http://localhost/api/integrations/crm/zoho/callback?code=abc&state=bad"), { params: Promise.resolve({ provider: "zoho" }) });
    expect(res.status).toBe(400);
  });
});
