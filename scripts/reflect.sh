#!/usr/bin/env bash
# reflect.sh — Mitsuhiko's local gate before push
# Usage: bash scripts/reflect.sh [branch]
#
# Runs the full pre-push checklist in sequence. Each step must pass before the
# next runs. Exit 0 = clean. Exit 1 = stop, fix, re-run.
#
# Martin's rule: the PR is for shared understanding, not catching your own errors.
# The local gate must be real. CI is not your debugger.

set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
BASE="${2:-origin/master}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  pi-builder reflect — pre-push gate"
echo "  branch : $BRANCH"
echo "  base   : $BASE"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Diff summary ──────────────────────────────────────────────────────────
echo "── 1. What changed ─────────────────────────────────────"
git diff "$BASE"..."$BRANCH" --stat
echo ""

# ── 2. Type casts — red flags ────────────────────────────────────────────────
echo "── 2. Type cast audit ──────────────────────────────────"
CASTS=$(git diff "$BASE"..."$BRANCH" -- '*.ts' | grep "^+" | grep -E "\bas (never|any|unknown)\b" || true)
if [ -n "$CASTS" ]; then
  echo "⚠  Found type casts — review each one:"
  echo "$CASTS"
  echo ""
else
  echo "✅ No as-never / as-any / as-unknown in diff"
  echo ""
fi

# ── 3. New function calls — signature check reminder ────────────────────────
echo "── 3. New function calls ───────────────────────────────"
NEW_CALLS=$(git diff "$BASE"..."$BRANCH" -- '*.ts' | grep "^+" | grep -oE "[a-zA-Z_][a-zA-Z0-9_]*\(" | sort -u || true)
if [ -n "$NEW_CALLS" ]; then
  echo "Functions called in this diff (verify signatures before push):"
  echo "$NEW_CALLS" | sed 's/^/   /'
else
  echo "No new function calls detected"
fi
echo ""

# ── 4. Typecheck ─────────────────────────────────────────────────────────────
echo "── 4. TypeScript ───────────────────────────────────────"
if bun run typecheck 2>&1; then
  echo "✅ TypeScript clean"
else
  echo "❌ TypeScript errors — fix before pushing"
  exit 1
fi
echo ""

# ── 5. Tests ─────────────────────────────────────────────────────────────────
echo "── 5. Tests ────────────────────────────────────────────"
if npx vitest run packages/core --reporter=verbose 2>&1 | tail -8; then
  echo "✅ Tests passed"
else
  echo "❌ Tests failed — fix before pushing"
  exit 1
fi
echo ""

# ── 6. Imports — missing files ───────────────────────────────────────────────
echo "── 6. Import sanity ────────────────────────────────────"
BROKEN=$(git diff "$BASE"..."$BRANCH" -- '*.ts' | grep "^+.*from '" | grep -oE "from '([^']+)'" | grep -v "node:" | grep -v "@" || true)
echo "New imports in diff (spot-check paths are real):"
if [ -n "$BROKEN" ]; then
  echo "$BROKEN" | sed 's/^/   /'
else
  echo "   (none)"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  Gate passed. Re-read the diff one more time before"
echo "  pushing — you are the reviewer now, not the author."
echo "═══════════════════════════════════════════════════════"
echo ""
git diff "$BASE"..."$BRANCH" -- '*.ts' '*.js' | head -200
