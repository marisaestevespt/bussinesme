#!/usr/bin/env bash
# ============================================================
# Test runner: Product rename cascade
# Invokes the SECURITY DEFINER function test_product_rename_cascade()
# which creates 17 dependent rows, renames a product, and verifies
# the new name propagated to every table via DB triggers.
#
# Requires PG* env vars (PGHOST, PGUSER, PGDATABASE, PGPASSWORD).
# Usage: bash scripts/test-product-rename-cascade.sh
# ============================================================
set -euo pipefail

echo "════════════════════════════════════════"
echo "  TEST: Product rename cascade"
echo "════════════════════════════════════════"

RESULTS=$(psql -tA -F $'\t' -c "SELECT passed, table_name, expected, actual FROM public.test_product_rename_cascade() ORDER BY passed, table_name;")

TOTAL=0; PASSED=0; FAILED=0
while IFS=$'\t' read -r p name expected actual; do
  TOTAL=$((TOTAL+1))
  if [ "$p" = "t" ]; then
    PASSED=$((PASSED+1))
    echo "  ✅ $name"
  else
    FAILED=$((FAILED+1))
    echo "  ❌ $name — expected='$expected' got='$actual'"
  fi
done <<< "$RESULTS"

echo "────────────────────────────────────────"
echo "  Total: $TOTAL · Passed: $PASSED · Failed: $FAILED"
if [ "$FAILED" -eq 0 ]; then
  echo "  ✅ ALL CASCADES OK"
  exit 0
else
  echo "  ❌ FAILURES DETECTED"
  exit 1
fi
