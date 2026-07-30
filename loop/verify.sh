#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
#  VERIFIER — READ ONLY to the improvement loop's agent.
#
#  Exits 0 only when every gate passes. Prints one machine-readable
#  LOOP_RESULT line last so a cycle can be logged without parsing prose.
#
#  Gate 0 is this script checking that it and its properties have not been
#  edited. A boundary the generator is merely *asked* to respect is not a
#  boundary; the agent optimises against whatever it can reach.
#
#  Usage:
#    loop/verify.sh              # run at the current ratchet floor
#    LOOP_RUNS=5000 loop/verify.sh
#    FULL=1 loop/verify.sh       # also run the production build (slow)
# ══════════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PROTECTED=(loop vitest.config.ts)
RATCHET="loop/ratchet.json"
RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'

fail() { echo "${RED}FAIL${OFF} $*"; }
ok()   { echo "${GRN}ok${OFF}   $*"; }

read_json() { python3 -c "
import json,sys
try:
    d=json.load(open('$RATCHET'))
except Exception:
    d={}
print(d.get('$1', '$2'))
"; }

# ── Gate 0: verifier integrity ──────────────────────────────────────────
# ratchet.json is excluded in every state: verify.sh writes it on each pass,
# so flagging it would make gate 0 fail forever after the first success. The
# baseRef diff below covers the files that actually define the target.
integrity_ok=1
if git rev-parse --git-dir >/dev/null 2>&1; then
  dirty=$(git status --porcelain -- "${PROTECTED[@]}" 2>/dev/null | grep -v 'loop/ratchet\.json$' || true)
  if [ -n "$dirty" ]; then
    fail "verifier modified — the generator may not edit the verifier"
    echo "$dirty" | sed 's/^/       /'
    integrity_ok=0
  fi

  base_ref=$(read_json baseRef "")
  if [ -n "$base_ref" ] && git cat-file -e "$base_ref" 2>/dev/null; then
    drift=$(git diff --name-only "$base_ref" -- loop/properties loop/verify.sh loop/vitest.loop.config.ts vitest.config.ts 2>/dev/null || true)
    if [ -n "$drift" ]; then
      fail "verifier drifted from baseRef $base_ref"
      echo "$drift" | sed 's/^/       /'
      integrity_ok=0
    fi
  fi
else
  echo "${YEL}warn${OFF} not a git repo — integrity check skipped"
fi
[ "$integrity_ok" = 1 ] && ok "verifier integrity"

# ── Gate 1: types ───────────────────────────────────────────────────────
tsc_ok=1
if npx tsc --noEmit >/tmp/loop-tsc.log 2>&1; then
  ok "tsc --noEmit"
else
  fail "tsc --noEmit"; tail -20 /tmp/loop-tsc.log | sed 's/^/       /'; tsc_ok=0
fi

# ── Gate 2: the project's own example tests ─────────────────────────────
unit_ok=1
if npx vitest run >/tmp/loop-unit.log 2>&1; then
  unit_line=$(grep -E "^ +Tests +" /tmp/loop-unit.log | tail -1 | tr -s ' ')
  ok "project tests —${unit_line#*Tests}"
else
  fail "project tests"
  grep -E "FAIL|×|Tests " /tmp/loop-unit.log | head -20 | sed 's/^/       /'
  unit_ok=0
fi

# ── Gate 3: the properties (the ratchet) ────────────────────────────────
floor=$(read_json runsFloor 300)
RUNS="${LOOP_RUNS:-$floor}"
SEED="${LOOP_SEED:-$RANDOM$RANDOM}"

prop_ok=1
if LOOP_RUNS="$RUNS" LOOP_SEED="$SEED" \
   npx vitest run --config loop/vitest.loop.config.ts >/tmp/loop-props.log 2>&1; then
  prop_line=$(grep -E "^ +Tests +" /tmp/loop-props.log | tail -1 | tr -s ' ')
  ok "properties @ runs=$RUNS seed=$SEED —${prop_line#*Tests}"
else
  fail "properties @ runs=$RUNS seed=$SEED"
  # The counterexample is the whole point — surface it, shrunk.
  sed -n '/Failed Tests/,/^ *Test Files/p' /tmp/loop-props.log \
    | grep -E "FAIL|Counterexample|Property failed|seed:|Shrunk|expected|AssertionError" \
    | head -30 | sed 's/^/       /'
  prop_ok=0
fi

# ── Gate 4: production build (opt-in; slow) ─────────────────────────────
build_ok=1
if [ "${FULL:-0}" = 1 ]; then
  if npm run build:check >/tmp/loop-build.log 2>&1; then
    ok "build:check"
  else
    fail "build:check"; tail -20 /tmp/loop-build.log | sed 's/^/       /'; build_ok=0
  fi
else
  echo "${DIM}skip build:check (set FULL=1)${OFF}"
fi

# ── Result + ratchet ────────────────────────────────────────────────────
if [ "$integrity_ok$tsc_ok$unit_ok$prop_ok$build_ok" = "11111" ]; then
  verdict=pass
  python3 - "$RUNS" "$SEED" <<'PY'
import json, sys, os, datetime
path = "loop/ratchet.json"
runs, seed = int(sys.argv[1]), sys.argv[2]
try:
    d = json.load(open(path))
except Exception:
    d = {}
d["runsFloor"] = max(int(d.get("runsFloor", 0)), runs)   # the floor only rises
d["lastPass"] = {"runs": runs, "seed": seed,
                 "at": datetime.datetime.now().isoformat(timespec="seconds")}
d["passes"] = int(d.get("passes", 0)) + 1
d.setdefault("baseRef", "")
json.dump(d, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY
  echo "${GRN}PASS${OFF} ratchet floor now $(read_json runsFloor 0)"
else
  verdict=fail
fi

echo "LOOP_RESULT verdict=$verdict runs=$RUNS seed=$SEED integrity=$integrity_ok tsc=$tsc_ok unit=$unit_ok props=$prop_ok build=$build_ok"
[ "$verdict" = pass ] || exit 1
