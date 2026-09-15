#!/usr/bin/env bash
# One-time production switches before the first paying client. Run from the
# repo root while `vercel whoami` prints custedlol:   bash scripts/prod-env-setup.sh
#
#   1. FOUNDER_EMAILS  — turns on /admin (create client workspaces, connect
#                        their WhatsApp number, go live) for the two founders.
#   2. CRON_SECRET     — same random value in Vercel and in the GitHub Actions
#                        secret, so /api/cron/process-queue stops being open.
#   3. Redeploys production so the new values take effect.
#
# Optional, prompted: RAZORPAY_* (turns on in-app checkout) and RESEND_API_KEY +
# EMAIL_FROM (invite emails). Leave blank to skip.
set -euo pipefail
cd "$(dirname "$0")/.."
account=$(vercel whoami 2>/dev/null | tail -1)
project=$(node -e 'try{console.log(require("./.vercel/project.json").projectName)}catch{console.log("(not linked)")}')
echo "Vercel account: ${account:-unknown} · linked project: $project (production = the CUSTEDLOL account)"
read -r -p "Continue? [y/N] " ok; [ "$ok" = "y" ] || { echo "Aborted."; exit 1; }

FOUNDERS="visheshjain1705@gmail.com,dhairyakakkar23@gmail.com"
read -r -p "Founder emails [$FOUNDERS]: " typed; FOUNDERS="${typed:-$FOUNDERS}"
printf '%s' "$FOUNDERS" | vercel env add FOUNDER_EMAILS production --yes --force --no-sensitive >/dev/null
echo "set   FOUNDER_EMAILS"

SECRET=$(openssl rand -hex 32)
printf '%s' "$SECRET" | vercel env add CRON_SECRET production --yes --force >/dev/null
printf '%s' "$SECRET" | gh secret set CRON_SECRET
echo "set   CRON_SECRET (Vercel + GitHub, ${#SECRET} chars)"

for name in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET RESEND_API_KEY EMAIL_FROM; do
  read -r -s -p "$name (blank = skip): " value; echo
  if [ -n "$value" ]; then printf '%s' "$value" | vercel env add "$name" production --yes --force >/dev/null; echo "set   $name"; fi
done

vercel --prod --yes
echo
echo "Done. Check: https://nudgeagent.app/admin (signed in as a founder) and"
echo "  gh run list --workflow cron-tick.yml --limit 1   → should be success."
