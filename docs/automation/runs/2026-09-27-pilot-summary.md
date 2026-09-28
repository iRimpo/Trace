# Manual pilot summary — 2026-09-27

Four code pilots are complete and reviewable as a cumulative branch chain. They remain local, unmerged, unpushed, undeployed, and not phone-validated.

| Pilot | Outcome | Reviewable head | Fresh evidence |
|---|---|---|---|
| TRACE-001 saved-session restoration | Complete saved trim, loop, framing, zoom, dancer and solo state resolves before tabs mount; corrupt state calibrates; explicit recalibration remains | `codex/pilot-resume-state` · `c9742ba` | helper/storage 20/20; component 4/4; full 203/203; typecheck; build |
| TRACE-002 stage accessibility | Evidenced stage controls have names/states, visible focus, and 44px targets at all breakpoints without media-geometry changes | `codex/pilot-stage-accessibility` · `5118ec6` | actual TraceTab RED→GREEN 2/2; component 6/6; full 203/203; typecheck; build |
| TRACE-006 signed-URL authentication | Server validates the user before input/storage; ownership and traversal rejection remain; owned path signs for one hour | `codex/pilot-signed-url-auth` · `4bf5b29` | actual handler RED 2/6 then GREEN 6/6; full 203/203; typecheck; build |
| TRACE-007 reopen onboarding | Dashboard exposes a named 44px “How Trace works” control; it opens the real tutorial; final guidance points to that control instead of nonexistent Settings | `codex/cycle-reopen-tutorial` · `23cc1f3` | actual dashboard component RED→GREEN 1/1; component 7/7; full 203/203; typecheck; build |

Independent review found and caused repair of TRACE-001's original component-ordering evidence gap. TRACE-002 then passed independent accessibility/code/behavior review with no findings. TRACE-006 passed independent security/code/behavior review with no findings.

TRACE-007 was completed in the explicitly requested self-loop. It passed a React best-practices self-review with no finding; no independent-review claim is made for it.

## Checks deliberately not claimed

- `loop/verify.sh` did not run because it mutates tracked ratchet files and uses shared `/tmp` logs. The completed 50,000 floor remains untouched.
- No physical phone, installed-PWA, VoiceOver/TalkBack, 8–10 ft readability, orientation/canvas alignment, constrained-device scan, offline reopen, or real group-footage run occurred.
- No production database/schema, storage contents, credential rotation, merge, push, or deployment was performed.

## Recurrence

No existing Trace automation was found. The approved weekday 09:00 America/Los_Angeles manager was not activated because credential rotation remains unconfirmed and real-phone validation still requires human/device participation. Those blocker fingerprints are unchanged, so unattended recurrence must not revisit them or claim readiness.
