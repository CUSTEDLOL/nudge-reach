#!/usr/bin/env bash
# Copy the voice env from .env.local into Vercel production, then deploy.
# Run from the repo root after `git pull`:   bash scripts/voice-push-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash local changes first — this deploys the working tree." >&2
  exit 1
fi
# nudgeagent.app is served by the CUSTEDLOL account's project (custedlols-projects).
# A checkout linked to a personal copy of the project pushes env + deploys somewhere
# nobody visits, so show the target and ask.
account=$(vercel whoami 2>/dev/null | tail -1)
project=$(node -e 'try{console.log(require("./.vercel/project.json").projectName)}catch{console.log("(not linked)")}')
echo "Vercel account: ${account:-unknown} · linked project: $project"
echo "Production (nudgeagent.app) lives on the CUSTEDLOL account. If that is not the account above,"
echo "run: vercel logout && vercel login && vercel link --yes --project nudge-reach --scope custedlols-projects"
read -r -p "Push the voice env to THIS account's project and deploy? [y/N] " ok
[ "$ok" = "y" ] || { echo "Aborted."; exit 1; }
for name in ELEVENLABS_API_KEY ELEVENLABS_AGENT_ID ELEVENLABS_WEBHOOK_SECRET ELEVENLABS_LLM \
            VOICE_INITIATION_SECRET VOICE_TOOLS_SECRET VOICE_TEST_ORG_ID; do
  # `|| true`: a missing key must skip, not abort the loop under set -e/pipefail.
  value=$(grep -E "^${name}=" .env.local | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//' || true)
  if [ -z "$value" ]; then echo "skip  $name (not in .env.local)"; continue; fi
  printf '%s' "$value" | vercel env add "$name" production --yes --force >/dev/null
  echo "set   $name (${#value} chars)"
done
vercel --prod --yes
