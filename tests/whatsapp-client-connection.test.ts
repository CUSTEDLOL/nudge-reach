import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { whatsappConnection: {
  findUnique: vi.fn(), upsert: vi.fn(),
} } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation", TOKEN_ENCRYPTION_KEY: "a-test-key-that-is-at-least-32-characters" } }));
import { saveClientConnection } from "@/modules/whatsapp/client-connection";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
const input = { orgId: "org-a", appId: "4408855649377723", appSecret: "1234567890abcdef1234567890abcdef" };
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); env.SEND_MODE = "simulation"; db.whatsappConnection.findUnique.mockResolvedValue(null); db.whatsappConnection.upsert.mockImplementation(async (args) => args.create); });
describe("client-owned Meta app", () => {
  it("encrypts secrets and creates a private callback without storing plaintext", async () => {
    await saveClientConnection(input);
    const data = db.whatsappConnection.upsert.mock.calls[0][0].create;
    expect(data.orgId).toBe("org-a");
    expect(data.appSecretEncrypted).not.toContain(input.appSecret);
    expect(decryptSecret(data.appSecretEncrypted)).toBe(input.appSecret);
    expect(decryptSecret(data.verifyTokenEncrypted)).toHaveLength(64);
    expect(data.webhookKey).toHaveLength(48);
  });
  it("rejects an app already owned by another workspace", async () => {
    db.whatsappConnection.findUnique.mockResolvedValue({ orgId: "org-b" });
    await expect(saveClientConnection(input)).rejects.toThrow(/another workspace/);
    expect(db.whatsappConnection.upsert).not.toHaveBeenCalled();
  });
  it("rotates verification and clears proof when the app secret changes", async () => {
    await saveClientConnection(input);
    const data = db.whatsappConnection.upsert.mock.calls[0][0].update;
    expect(data.verifiedAt).toBeNull();
    expect(data.lastInboundAt).toBeNull();
    expect(data.activeAt).toBeUndefined(); // never re-enable the legacy fallback
    expect(data.webhookKey).toBeUndefined(); // keep callback stable
  });
  it("rejects malformed credentials before writing", async () => {
    await expect(saveClientConnection({ ...input, appSecret: "wrong" })).rejects.toThrow();
    expect(db.whatsappConnection.upsert).not.toHaveBeenCalled();
  });
});

it("refuses to reserve a public app ID without its correct secret in live mode", async () => {
  env.SEND_MODE = "live";
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 400 }));
  await expect(saveClientConnection(input)).rejects.toThrow(/Meta rejected/);
  expect(db.whatsappConnection.upsert).not.toHaveBeenCalled();
});
it("validates live credentials without putting the secret in the URL", async () => {
  env.SEND_MODE = "live";
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: input.appId })));
  await saveClientConnection(input);
  expect(fetcher).toHaveBeenCalledWith(expect.not.stringContaining(input.appSecret), expect.objectContaining({ headers: { Authorization: `Bearer ${input.appId}|${input.appSecret}` } }));
  expect(db.whatsappConnection.upsert).toHaveBeenCalled();
});
