#!/usr/bin/env bash
# Wait until a PR's required CI check has REGISTERED and passed, then merge.
#
# Background: a previous helper polled `gh pr checks` immediately after
# pushing and saw only the Vercel preview status. With nothing "pending",
# the script considered the PR ready and merged — before the real
# "Lint, Typecheck, Test, Build" workflow had even started. This script
# fixes that by:
#   1. Waiting INITIAL_WAIT seconds for GitHub to register all checks.
#   2. Polling until the named REQUIRED_CHECK actually appears in the list.
#   3. Only then treating the absence of pending entries as "checks complete".
#
# Usage:
#   bash scripts/await-and-merge-pr.sh <pr-number> [merge|squash|rebase]
#
# Env knobs:
#   REQUIRED_CHECK   default "Lint, Typecheck, Test, Build"
#   INITIAL_WAIT     default 30  (seconds)
#   POLL             default 15  (seconds between polls)
#   MAX_WAIT         default 1800 (seconds cap, 30 min)
#
# Exit codes: 0 merged, 1 a required/expected check failed, 2 timeout,
#             >2 underlying gh/jq failure.

set -euo pipefail

PR="${1:?usage: $0 <pr-number> [merge|squash|rebase]}"
STRATEGY="${2:-merge}"
REQUIRED_CHECK="${REQUIRED_CHECK:-Lint, Typecheck, Test, Build}"
INITIAL_WAIT="${INITIAL_WAIT:-30}"
POLL="${POLL:-15}"
MAX_WAIT="${MAX_WAIT:-1800}"

case "$STRATEGY" in
  merge|squash|rebase) ;;
  *) echo "strategy must be merge, squash, or rebase (got: $STRATEGY)" >&2; exit 3 ;;
esac

echo "[await-and-merge] PR #$PR — waiting ${INITIAL_WAIT}s for GitHub to register checks..."
sleep "$INITIAL_WAIT"

deadline=$(( $(date +%s) + MAX_WAIT ))

while :; do
  if (( $(date +%s) > deadline )); then
    echo "[await-and-merge] timed out after ${MAX_WAIT}s waiting for checks to settle" >&2
    exit 2
  fi

  registered=$(gh pr checks "$PR" --json name --jq "any(.name == \"$REQUIRED_CHECK\")" 2>/dev/null || echo "false")
  if [ "$registered" != "true" ]; then
    echo "[await-and-merge] required check '$REQUIRED_CHECK' not registered yet"
    sleep "$POLL"
    continue
  fi

  pending=$(gh pr checks "$PR" --json bucket --jq '[.[] | select(.bucket == "pending")] | length')
  if [ "$pending" != "0" ]; then
    echo "[await-and-merge] $pending check(s) pending"
    sleep "$POLL"
    continue
  fi

  failed=$(gh pr checks "$PR" --json name,bucket --jq '.[] | select(.bucket == "fail" or .bucket == "cancel") | .name')
  if [ -n "$failed" ]; then
    echo "[await-and-merge] one or more checks failed:" >&2
    echo "$failed" >&2
    exit 1
  fi

  break
done

echo "[await-and-merge] all checks green, merging PR #$PR (--$STRATEGY)"
gh pr merge "$PR" "--$STRATEGY" --delete-branch
