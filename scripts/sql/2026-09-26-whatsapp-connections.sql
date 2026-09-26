-- Additive rollout before the application deploy. RLS is enabled in the same
-- transaction, with no client access: Prisma's server-only owner role mediates it.
BEGIN;
CREATE TABLE IF NOT EXISTS "WhatsappConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL UNIQUE REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "appId" TEXT NOT NULL UNIQUE,
  "appSecretEncrypted" TEXT NOT NULL,
  "verifyTokenEncrypted" TEXT NOT NULL,
  "webhookKey" TEXT NOT NULL UNIQUE,
  "verifiedAt" TIMESTAMP(3),
  "activeAt" TIMESTAMP(3),
  "lastInboundAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "WhatsappConnection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WhatsappConnection" FROM anon, authenticated;
COMMIT;
