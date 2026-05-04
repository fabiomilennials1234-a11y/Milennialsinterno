#!/usr/bin/env bash
# Run SQL on linked Supabase project via Management API.
# Usage: scripts/sb-sql.sh <path-to.sql>   OR   scripts/sb-sql.sh -c "SELECT 1"
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; source .env.scripts; set +a
if [[ "${1:-}" == "-c" ]]; then
  SQL="$2"
elif [[ -f "${1:-}" ]]; then
  SQL="$(cat "$1")"
else
  echo "Usage: $0 <file.sql>  OR  $0 -c \"<sql>\"" >&2
  exit 1
fi
PAYLOAD=$(jq -nc --arg q "$SQL" '{query:$q}')
RESP=$(curl -sS -w "\n%{http_code}" -X POST \
  "https://api.supabase.com/v1/projects/${VITE_SUPABASE_PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
BODY=$(echo "$RESP" | sed '$d'); CODE=$(echo "$RESP" | tail -n1)
echo "$BODY"
[[ "$CODE" =~ ^2 ]] || { echo "HTTP $CODE" >&2; exit 1; }
