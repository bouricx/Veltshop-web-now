#!/usr/bin/env bash
# Run AFTER: vercel login + Neon DATABASE_URL in .env.production.local
set -euo pipefail
cd "$(dirname "$0")/.."
ENVF=.env.production.local
if [[ ! -f "$ENVF" ]]; then
  echo "Missing $ENVF" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENVF"
set +a
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL missing in $ENVF — create Neon project and paste connection string" >&2
  exit 1
fi
if [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
  echo "BETTER_AUTH_SECRET missing" >&2
  exit 1
fi
if [[ -z "${SLIP_VERIFY_URL:-}" ]]; then
  echo "SLIP_VERIFY_URL missing (interim trycloudflare or lasting API URL)" >&2
  exit 1
fi
npx vercel link --yes
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  # Strip surrounding quotes (needed for bash-safe .env; Vercel stores literals)
  if [[ ${#val} -ge 2 ]]; then
    if [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then
      val="${val:1:-1}"
    elif [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then
      val="${val:1:-1}"
    fi
  fi
  [[ -z "$val" ]] && continue
  printf '%s' "$val" | npx vercel env add "$key" production --force || true
done < "$ENVF"
npx vercel --prod --yes
