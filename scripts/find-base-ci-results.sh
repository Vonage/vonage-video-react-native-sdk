#!/usr/bin/env bash
# Finds the PR CI run that tested a commit and downloads its Jest results.
# Usage: scripts/find-base-ci-results.sh <commit-sha> <output-dir>
# Env: GH_TOKEN (actions:read, pull-requests:read), GH_REPO (owner/repo).
# Exit 0 with results in <output-dir>/<artifact>/artifacts/jest-results-*.json,
# exit 3 if no usable run was found (caller decides what to do).
set -euo pipefail
SHA="$1"; OUT="$2"

# The commit a release branch is cut from is normally the merge commit of a PR into develop.
# PR CI ran on that PR's head commit, so look the PR up first.
PR_HEAD=$(gh api "repos/$GH_REPO/commits/$SHA/pulls" \
  --jq '[.[] | select(.merged_at != null)] | sort_by(.merged_at) | last | .head.sha // empty' 2>/dev/null || true)
CANDIDATES=("$SHA")
[ -n "$PR_HEAD" ] && CANDIDATES=("$PR_HEAD" "$SHA")

for C in "${CANDIDATES[@]}"; do
  # Newest completed PR CI runs for that commit (re-runs included).
  for RUN in $(gh api "repos/$GH_REPO/actions/workflows/ci-pr-tests.yml/runs?head_sha=$C&status=completed&per_page=20" \
      --jq '.workflow_runs | sort_by(.created_at) | reverse | .[].id'); do
    # Only runs whose E2E jobs actually ran (not skipped / cancelled before tests).
    RAN=$(gh api "repos/$GH_REPO/actions/runs/$RUN/jobs?per_page=50" \
      --jq '[.jobs[] | select((.name | startswith("e2e-")) and (.conclusion == "success" or .conclusion == "failure"))] | length')
    [ "$RAN" -gt 0 ] || continue
    rm -rf "$OUT"; mkdir -p "$OUT"
    if gh run download "$RUN" -R "$GH_REPO" -p '*e2e-diagnostics*' -D "$OUT" 2>/dev/null \
       && ls "$OUT"/*/artifacts/jest-results-*.json >/dev/null 2>&1; then
      echo "Using PR CI run $RUN (commit $C) for $SHA"
      echo "run_id=$RUN" >> "${GITHUB_OUTPUT:-/dev/null}"
      exit 0
    fi
  done
done
echo "::warning::No PR CI run with E2E results found for $SHA (PR head: ${PR_HEAD:-none})."
exit 3
