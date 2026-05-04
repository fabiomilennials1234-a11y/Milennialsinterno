#!/usr/bin/env bash
# Run a pgTAP test file on linked Supabase project via Management API.
# Each test file is expected to start with BEGIN; ... and end with ROLLBACK;
# Exits non-zero if any "not ok" line is present.
# Usage: scripts/sb-pgtap.sh <path-to-test.sql>
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f "${1:-}" ]] || { echo "Usage: $0 <test.sql>" >&2; exit 2; }
OUT=$(./scripts/sb-sql.sh "$1")
echo "$OUT" | jq -r '.[] | (. | to_entries | map(.value) | join("\t"))' 2>/dev/null || echo "$OUT"
if echo "$OUT" | grep -q "not ok"; then
  echo "FAIL: pgTAP test contém 'not ok'" >&2
  exit 1
fi
echo "OK: pgTAP test passou"
