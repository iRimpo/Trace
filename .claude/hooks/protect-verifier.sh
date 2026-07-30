#!/usr/bin/env bash
# PreToolUse guard for the cue-invariant improvement loop.
#
# Denies file-editing tools on the verifier: loop/**, vitest.config.ts, and this
# guard plus the settings that install it (otherwise the boundary can disable
# itself). Reads the hook payload on stdin, emits a deny decision as JSON.
#
# This blocks the Edit/Write path only. It cannot stop a shell redirect, which
# is why loop/verify.sh independently re-checks its own integrity against git.
# Defence in depth, not a sandbox.

payload=$(cat)

path=$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)
ti = d.get("tool_input") or {}
print(ti.get("file_path") or ti.get("notebook_path") or "")
' 2>/dev/null)

[ -z "$path" ] && exit 0

case "$path" in
  */loop/*|loop/*)                             reason="loop/ is the verifier" ;;
  */vitest.config.ts|vitest.config.ts)         reason="removing the property suite from a run is not progress" ;;
  */.claude/hooks/*|.claude/hooks/*)           reason="this guard protects the boundary" ;;
  */.claude/settings.json|.claude/settings.json) reason="this installs the guard" ;;
  *) exit 0 ;;
esac

python3 - "$reason" <<'PY'
import json, sys
msg = (
    f"Denied: {sys.argv[1]}. The improvement loop's generator may not edit its own "
    "verifier — see loop/program.md. Work in lib/ and record findings in "
    "experiments.md. If a property itself looks wrong, stop and report it to the "
    "human; do not weaken the code to match a bad test."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": msg,
    }
}))
PY
exit 0
