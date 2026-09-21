/**
 * Idempotent acquisition-trial allowance backfill:
 * npm run backfill:trial-knowledge
 *
 * A successful legacy source consumes one matching slot. Guarded assignments
 * make concurrent runs and retries harmless; rows without a successful source
 * are never touched.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";

export interface TrialKnowledgeBackfillClient {
  acquisitionTrial: {
    updateMany(
      args: Prisma.AcquisitionTrialUpdateManyArgs,
    ): Promise<{ count: number }>;
  };
}

export async function backfillTrialKnowledgeLimits(
  client: TrialKnowledgeBackfillClient,
) {
  const [web, file] = await Promise.all([
    client.acquisitionTrial.updateMany({
      where: {
        knowledgeSourceUsedAt: { not: null },
        knowledgeSource: { in: ["website", "gbp"] },
        knowledgeWebImportsUsed: { lt: 1 },
      },
      data: { knowledgeWebImportsUsed: 1 },
    }),
    client.acquisitionTrial.updateMany({
      where: {
        knowledgeSourceUsedAt: { not: null },
        knowledgeSource: "file",
        knowledgeFileImportsUsed: { lt: 1 },
      },
      data: { knowledgeFileImportsUsed: 1 },
    }),
  ]);

  return {
    webTrialsUpdated: web.count,
    fileTrialsUpdated: file.count,
  };
}

function loadProjectEnv() {
  const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
  for (const file of [".env.local", ".env"]) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

async function main() {
  loadProjectEnv();
  const prisma = new PrismaClient();
  try {
    const result = await backfillTrialKnowledgeLimits(prisma);
    console.log(
      `Trial knowledge backfill done: ${result.webTrialsUpdated} web trial(s), ${result.fileTrialsUpdated} file trial(s) updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
