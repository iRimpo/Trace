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
