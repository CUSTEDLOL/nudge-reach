import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, inbound } = vi.hoisted(() => ({
  inbound: vi.fn(),
  db: {
    whatsappConnection: { findUnique: vi.fn(), update: vi.fn() },
    whatsappAccount: { findFirst: vi.fn(), findMany: vi.fn() },
    webhookEvent: { create: vi.fn(), update: vi.fn() },
    conversationMessage: { findFirst: vi.fn() },
    message: { findFirst: vi.fn(), update: vi.fn() },
    template: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/env", () => ({ env: { META_APP_SECRET: "legacy-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "legacy-verify" } }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: (v: string) => v }));
vi.mock("@/modules/agent/inbound", () => ({ handleInboundMessage: inbound }));
import { GET, POST } from "@/app/api/webhooks/whatsapp/[connectionKey]/route";
import { POST as legacyPost } from "@/app/api/webhooks/whatsapp/route";
const context = { params: Promise.resolve({ connectionKey: "private-key" }) };
const connection = { id: "conn-a", orgId: "org-a", appSecretEncrypted: "secret-a", verifyTokenEncrypted: "verify-a", verifiedAt: new Date(), activeAt: new Date() };
function payload(waba = "waba-a", phone = "phone-a") { return { object: "whatsapp_business_account", entry: [{ id: waba, changes: [{ field: "messages", value: { metadata: { phone_number_id: phone }, messages: [{ id: "wamid.one", from: "6590000000", text: { body: "hello" } }], statuses: [{ id: "wamid.sent", status: "delivered" }] } }] }] }; }
function request(body: unknown = payload(), secret = "secret-a") {
  const raw = JSON.stringify(body);
  return new Request("https://example.test/api/webhooks/whatsapp/private-key", { method: "POST", body: raw, headers: { "x-hub-signature-256": "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex") } });
}
beforeEach(() => {
  vi.clearAllMocks();
  db.whatsappConnection.findUnique.mockResolvedValue(connection);
  db.whatsappAccount.findFirst.mockImplementation(async ({ where }) => where.orgId === "org-a" && where.wabaId === "waba-a" && where.phoneNumberId === "phone-a" ? { id: "account-a", orgId: "org-a" } : null);
  db.whatsappAccount.findMany.mockResolvedValue([]);
  db.webhookEvent.create.mockResolvedValue({ id: "evt-a" });
  db.conversationMessage.findFirst.mockResolvedValue(null);
  db.message.findFirst.mockResolvedValue(null);
  inbound.mockResolvedValue({});
});
describe("dedicated client webhook", () => {
  it("verifies only its own token and records activation", async () => {
    const res = await GET(new Request("https://example.test/?hub.mode=subscribe&hub.verify_token=verify-a&hub.challenge=123"), context);
    expect(res.status).toBe(200); expect(await res.text()).toBe("123");
    expect(db.whatsappConnection.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conn-a" }, data: expect.objectContaining({ verifiedAt: expect.any(Date), activeAt: expect.any(Date) }) }));
    expect((await GET(new Request("https://example.test/?hub.mode=subscribe&hub.verify_token=legacy-verify"), context)).status).toBe(403);
  });
  it("does not accept another app or legacy signature", async () => {
    expect((await POST(request(payload(), "secret-b"), context)).status).toBe(401);
    expect((await POST(request(payload(), "legacy-secret"), context)).status).toBe(401);
    expect(db.webhookEvent.create).not.toHaveBeenCalled();
  });
  it("rejects malformed hex without throwing", async () => {
    const req = request(); req.headers.set("x-hub-signature-256", "sha256=" + "z".repeat(64));
    expect((await POST(req, context)).status).toBe(401);
  });
  it.each([["waba-b", "phone-a"], ["waba-a", "phone-b"]])("ignores foreign account %s/%s before message or status processing", async (waba, phone) => {
    expect((await POST(request(payload(waba, phone)), context)).status).toBe(200);
    expect(inbound).not.toHaveBeenCalled(); expect(db.message.findFirst).not.toHaveBeenCalled();
    expect(db.whatsappConnection.update).not.toHaveBeenCalled();
  });
  it("routes a real message only to its workspace and scopes delivery and dedupe queries", async () => {
    expect((await POST(request(), context)).status).toBe(200);
    expect(inbound).toHaveBeenCalledWith("org-a", "6590000000", "hello", { metaMessageId: "wamid.one", whatsappAccountId: "account-a" });
    expect(db.message.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ campaign: expect.objectContaining({ orgId: "org-a" }) }) });
    expect(db.conversationMessage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ conversation: expect.objectContaining({ orgId: "org-a" }) }) }));
    expect(db.whatsappConnection.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastInboundAt: expect.any(Date) } }));
  });
  it("ignores Meta's sample phone rather than claiming a real receipt", async () => {
    await POST(request(payload("waba-a", "123456123")), context);
    expect(db.whatsappConnection.update).not.toHaveBeenCalled();
  });
  it("scopes template account lookups to the verified workspace", async () => {
    const body = { object: "whatsapp_business_account", entry: [{ id: "waba-b", changes: [{ field: "message_template_status_update", value: { event: "APPROVED", message_template_name: "reminder" } }] }] };
    await POST(request(body), context);
    expect(db.whatsappAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { wabaId: "waba-b", orgId: "org-a" } }));
    expect(db.template.findFirst).not.toHaveBeenCalled();
  });
  it("does not use the shared callback for activated workspaces", async () => {
    await legacyPost(request(payload(), "legacy-secret"));
    expect(db.whatsappAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ org: { whatsappConnection: { is: null } } }, { org: { whatsappConnection: { is: { activeAt: null } } } }] }) }));
    expect(inbound).not.toHaveBeenCalled();
  });
});
