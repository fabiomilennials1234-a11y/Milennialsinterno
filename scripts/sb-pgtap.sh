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
# The Supabase Management API (/database/query) returns ONLY the final result
# set, not the full TAP stream. A failing assertion surfaces via the
# `# Looks like you failed N test(s)` summary emitted by finish(); a passing
# run never emits that line. So we gate on BOTH the per-line `not ok` (when the
# stream is fully returned, e.g. via psql) AND the failure summary line.
if echo "$OUT" | grep -qE "not ok|Looks like you failed|Looks like your test died|planned [0-9]+ tests? but ran"; then
  echo "FAIL: pgTAP test reportou falha ('not ok' / 'failed' / 'died' / plan mismatch)" >&2
  exit 1
fi
echo "OK: pgTAP test passou"
