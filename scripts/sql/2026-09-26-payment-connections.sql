-- Additive: each workspace's own Razorpay account for customer payment links.
-- Apply BEFORE deploying the code that reads it. RLS on, no client grants;
-- Prisma's server-side owner role is the only reader.
BEGIN;
CREATE TABLE IF NOT EXISTS "PaymentConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL UNIQUE REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'razorpay',
  "keyId" TEXT NOT NULL,
  "keySecretEncrypted" TEXT NOT NULL,
  "webhookSecretEncrypted" TEXT NOT NULL,
  "webhookKey" TEXT NOT NULL UNIQUE,
  "verifiedAt" TIMESTAMP(3),
  "lastEventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "PaymentConnection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PaymentConnection" FROM anon, authenticated;
COMMIT;
