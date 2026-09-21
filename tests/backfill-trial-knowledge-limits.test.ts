import { beforeEach, describe, expect, it, vi } from "vitest";
import { backfillTrialKnowledgeLimits } from "../scripts/backfill-trial-knowledge-limits";

const updateMany = vi.fn();
const client = { acquisitionTrial: { updateMany } };

describe("trial knowledge allowance backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
  });

  it("sets successful legacy web and file sources to at least one", async () => {
    await expect(backfillTrialKnowledgeLimits(client)).resolves.toEqual({
      webTrialsUpdated: 2,
      fileTrialsUpdated: 3,
    });

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        knowledgeSourceUsedAt: { not: null },
        knowledgeSource: { in: ["website", "gbp"] },
        knowledgeWebImportsUsed: { lt: 1 },
      },
      data: { knowledgeWebImportsUsed: 1 },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        knowledgeSourceUsedAt: { not: null },
        knowledgeSource: "file",
        knowledgeFileImportsUsed: { lt: 1 },
      },
      data: { knowledgeFileImportsUsed: 1 },
    });
  });

  it("uses guarded assignments rather than increments, so reruns are harmless", async () => {
    await backfillTrialKnowledgeLimits(client);

    for (const [args] of updateMany.mock.calls) {
      expect(args.data).not.toHaveProperty("knowledgeWebImportsUsed.increment");
      expect(args.data).not.toHaveProperty("knowledgeFileImportsUsed.increment");
    }
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain("increment");
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain("interview");
  });
});
