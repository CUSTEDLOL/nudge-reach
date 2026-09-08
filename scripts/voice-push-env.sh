#!/usr/bin/env bash
# Copy the voice env from .env.local into Vercel production, then deploy.
# Run from the repo root after `git pull`:   bash scripts/voice-push-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash local changes first — this deploys the working tree." >&2
  exit 1
fi
for name in ELEVENLABS_API_KEY ELEVENLABS_AGENT_ID ELEVENLABS_WEBHOOK_SECRET ELEVENLABS_LLM \
            VOICE_INITIATION_SECRET VOICE_TOOLS_SECRET VOICE_TEST_ORG_ID; do
  value=$(grep -E "^${name}=" .env.local | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//')
  if [ -z "$value" ]; then echo "skip  $name (not in .env.local)"; continue; fi
  printf '%s' "$value" | vercel env add "$name" production --yes --force >/dev/null
  echo "set   $name (${#value} chars)"
done
vercel --prod --yes
