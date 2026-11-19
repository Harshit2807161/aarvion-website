#!/bin/sh
# Merge a PR only when every required check passes by name. Never deletes branches.
# Usage: merge-gate.sh <pr-number>
set -e
n="$1"; R=Harshit2807161/aarvion-website
# wait for checks to register (a fresh PR reports "no checks" for a few seconds)
i=0; while [ $i -lt 30 ] && gh pr checks "$n" --repo "$R" 2>&1 | grep -q "no checks"; do sleep 10; i=$((i+1)); done
gh pr checks "$n" --repo "$R" --watch --interval 20 >/dev/null 2>&1 || true
out=$(gh pr checks "$n" --repo "$R" 2>&1) || true
CHECKS="lint typecheck unit int build e2e pr-title branch-name pr-size"
# pr-size is required too; ALLOW_OVERSIZE=1 only for a documented, ruled exception (e.g. design prototype imports)
[ "$ALLOW_OVERSIZE" = "1" ] && CHECKS="lint typecheck unit int build e2e pr-title branch-name"
for c in $CHECKS; do
  echo "$out" | awk -v c="$c" '$1==c && $2=="pass"{f=1} END{exit !f}' || { echo "BLOCKED: required check '$c' not passing on #$n"; echo "$out" | awk '{print $1, $2}'; exit 2; }
done
ADMIN=""; [ "$ALLOW_OVERSIZE" = "1" ] && ADMIN="--admin"  # pr-size is a required check on main; a ruled exception needs the owner override
if [ -n "$2" ]; then gh pr merge "$n" --repo "$R" --squash $ADMIN --body-file "$2"; else gh pr merge "$n" --repo "$R" --squash $ADMIN; fi
echo "merged #$n"
