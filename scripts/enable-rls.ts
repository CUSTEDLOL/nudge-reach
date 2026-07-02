/**
 * Enable Row Level Security on every table in the public schema (spec §3.3).
 *
 * Prisma connects as the table owner (which bypasses RLS), so enabling RLS
 * with NO policies means the Supabase publishable key can't read or write
 * any table directly — all data access goes through the app's server code.
 * Idempotent: re-enabling an already-enabled table is a no-op. Run after
 * every `db:push` (new tables start with RLS disabled).
 *
 * Run: npm run db:rls
 *   (npx esbuild scripts/enable-rls.ts --bundle --platform=node --format=cjs \
 *      --outfile=.next/enable-rls.cjs --external:@prisma/client && node .next/enable-rls.cjs)
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
const envFile = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  // Use the direct (non-pooled) connection for DDL, like migrations do.
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });

  const tables = await prisma.$queryRawUnsafe<
    Array<{ tablename: string; rowsecurity: boolean }>
  >(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  if (tables.length === 0) {
    console.log("No tables found in schema public — run db:push first.");
  }

  let failures = 0;
  for (const { tablename, rowsecurity } of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tablename}" ENABLE ROW LEVEL SECURITY`
      );
      console.log(
        `✅ ${tablename}: RLS enabled${rowsecurity ? " (was already enabled)" : ""}`
      );
    } catch (err) {
      failures += 1;
      console.error(
        `❌ ${tablename}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`${failures} table(s) failed — see above.`);
    process.exit(1);
  }
  console.log(`Done: RLS enabled on ${tables.length} table(s).`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
