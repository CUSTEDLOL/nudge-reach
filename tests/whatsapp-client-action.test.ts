import { beforeEach, expect, it, vi } from "vitest";
const { save, auth, role } = vi.hoisted(() => ({ save: vi.fn(), auth: vi.fn(), role: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext: auth, requireRole: role }));
vi.mock("@/modules/whatsapp/client-connection", () => ({ saveClientConnection: save, ClientConnectionError: class extends Error {} }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveMetaAppAction } from "@/app/(app)/settings/whatsapp/meta-app-actions";
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ org: { id: "own-org" }, role: "ADMIN" }); role.mockImplementation(() => {}); save.mockResolvedValue({}); });
function data() { const f = new FormData(); f.set("appId", "4408855649377723"); f.set("appSecret", "1234567890abcdef1234567890abcdef"); f.set("orgId", "foreign-org"); return f; }
it("uses authenticated workspace, never client-supplied orgId", async () => { expect((await saveMetaAppAction(data())).ok).toBe(true); expect(save).toHaveBeenCalledWith(expect.objectContaining({ orgId: "own-org" })); });
it("rejects an agent before persisting any credentials", async () => { role.mockImplementation(() => { throw new Error("Admin required"); }); expect((await saveMetaAppAction(data())).ok).toBe(false); expect(save).not.toHaveBeenCalled(); });
it("does not leak database errors or secrets", async () => { save.mockRejectedValue(new Error("database error secret=bad")); expect((await saveMetaAppAction(data())).message).not.toContain("secret=bad"); });
