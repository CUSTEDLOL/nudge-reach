import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, requireFounder, auditExportRows, serializeAuditCsv } = vi.hoisted(() => ({
  calls: [] as string[],
  requireFounder: vi.fn(async () => { calls.push("auth"); }),
  auditExportRows: vi.fn(async () => { calls.push("query"); return []; }),
  serializeAuditCsv: vi.fn(() => "Time,Result\r\n"),
}));

vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/admin/audit-log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/admin/audit-log")>();
  return { ...actual, auditExportRows, serializeAuditCsv };
});

import { csvCell } from "@/modules/admin/audit-log";
import { GET } from "@/app/admin/audit/export/route";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe("audit CSV", () => {
  it.each(["=SUM(A1)", "+cmd", "-secret", "@handle"])(
    "neutralizes formula-like value %j",
    (value) => expect(csvCell(value).startsWith("'") || csvCell(value).startsWith("\"'")).toBe(true)
  );

  it("authenticates before querying and returns a private attachment", async () => {
    const response = await GET(new Request("https://nudge.test/admin/audit/export?orgId=org-1&result=failed"));
    expect(calls).toEqual(["auth", "query"]);
    expect(auditExportRows).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", result: "failed" }));
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="nudge-admin-audit-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
