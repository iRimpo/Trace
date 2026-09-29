# Trace automation decisions

## 2026-09-24 baseline rulings

- Local `main` (`65cfa46`) is the appropriate source for pilots because it contains the approved local UX work and `ws0-foundations` is already its ancestor. GitHub and production remain at `e27c02e`; no pilot may imply it is deployed.
- The 50,000 cue-input floor is a completed target, not an endlessly increasing metric. The baseline does not run the mutating loop verifier.
- The manager worktree lives outside the repository at `/Users/richard/Documents/GitHub/claude/Trace-worktrees/manager` because the project has no ignored local worktree directory and the main checkout contains user-owned untracked `.agents/` and `.codex/` content.
- Historical documentation is evidence of intent or past observation, not present truth. Current code and fresh checks decide eligibility.
- Pilot order is saved-session restoration, accessible stage controls, then real-phone validation. The first two address current core-workflow evidence; the third is a release-evidence gate and must not be converted into a blind code change.
- Production provenance was verified read-only through Vercel: project `trace-app` is READY at `e27c02e`, the same commit returned by current GitHub `main`.
- A build without ignored local environment values is an isolation failure, not a product regression. Both the failed first attempt and successful rerun are retained in the baseline record.
- Recurrence cannot activate unless all pilots succeed. Missing phone participation, unconfirmed credential rotation, or orchestration/safety failure leaves it inactive.

## 2026-09-27 recurrence decision

- Three bounded code pilots produced reviewable local branches with fresh tests, builds, and independent review. None was merged, pushed, or deployed.
- Existing automation inspection found only `larry-daily-secretary` and `still-finance-check-ins`; no Trace manager duplicate exists.
- Recurrence remains inactive. The exact safety blocker is unconfirmed rotation of previously exposed Vercel and Supabase tokens. The exact release-evidence blocker is the absence of a human-observed real-phone run. An unattended manager must not inherit ambiguous deployment-capable credentials or convert desktop automation into a phone-readiness claim.
- When those blockers change, create one task-attached weekday 09:00 America/Los_Angeles heartbeat manager. It must select one eligible item, use the smallest team, serialize verification, update durable state, remain quiet on unchanged state, and include weekly prioritization plus monthly workflow/research review in the same manager.

## 2026-09-28 whole-site direction discovery

- Preserve Trace's ratified two-ground model: cream paper for entry, auth, dashboard, and video choice; dark translucent stage chrome over live camera for practice. The portfolio revamp is a useful reference for finite semantic surfaces, typography roles, and failure-safe motion, not a skin to transplant.
- The recommended direction is “one journey, two grounds, one practice object.” Prioritize truthful entry language, coherent local-library versus cloud-history actions, and a stable practice-asset identity before a visual re-theme.
- Immediate low-risk language work can replace “upload” with “add” or “choose” and distinguish “Continue on this device” from “Progress history.” A unified library remains blocked on deciding which non-video identity may be persisted with session metadata.
- Three product decisions remain intentionally open: whether visitors without invite codes can request access, whether practising again auto-saves an unfinished result, and whether a stable opaque practice-asset identity may be stored server-side.
- External research supports just-in-time camera permission, visual framing readiness, rehearsal-first loop/speed/mirror controls, explicit camera state, immediate review, and honest local-storage durability language. These are hypotheses to validate in Trace, not substitutes for user research.
