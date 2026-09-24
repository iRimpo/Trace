# Trace release and phone checklist

## Provenance and safety

- [ ] Record candidate commit, branch, worktree, dirty state, GitHub `main`, and production commit.
- [ ] Confirm Vercel and Supabase credentials previously exposed are rotated.
- [ ] Confirm required migrations separately; do not apply migration `008` during validation.
- [ ] Verify no full reference-video upload or new server-side video storage was introduced.
- [ ] Review transmitted thumbnail, file-hash, movement-coordinate/bounds, session, and analytics data against consent/retention language.
- [ ] Run typecheck, focused tests, full unit suite, and `build:check`; record executed versus skipped.
- [ ] If the loop verifier is required, run it alone at 50,000 with a fresh seed and reconcile both ratchet files.

## Physical phone matrix

For each run, record phone model, OS version, browser or installed PWA, network state, commit/deployment URL, reference clip, group clip, and observer.

- [ ] First-time: install/open, upload a non-sensitive reference, grant camera access, understand calibration, and reach basic practice without waiting for scan completion.
- [ ] Distance: prop the phone 8–10 feet away; verify primary controls, count/drill readouts, errors, and recording state are readable and targets are usable.
- [ ] Orientation: rotate portrait ↔ landscape; verify layout follows orientation and visible video landmarks stay aligned with canvas/skeleton landmarks.
- [ ] Drill: set A/B, run WATCH then DANCE hands-free, loop repeatedly, and verify cues remain optional/experimental.
- [ ] Return: leave the app, reopen offline, select the saved video/session, and confirm trim, loop, framing, zoom, and dancer selection restore without mandatory recalibration.
- [ ] Limited resources: while scan is active, verify playback/basic practice remains responsive; record total scan time, seek/detect timing, memory symptoms, heat, and battery impact.
- [ ] Group footage: select a non-default dancer, observe crossings/occlusion, record identity retention and reacquire prompts, and confirm the chosen trim bounds scoring/recording.
- [ ] Accessibility: inspect accessible names/states, keyboard focus where available, reduced-motion behavior, contrast in a bright room, and 44px target geometry.
- [ ] Capture screenshots/video, timings, pass/fail, and exact reproduction steps. A failure becomes a separate evidence-backed item; do not fix it during the validation run.

## Release statement

- [ ] Automated checks are green.
- [ ] Physical-device checks are complete at the candidate commit.
- [ ] Known privacy/security blockers are resolved or explicitly accepted by the owner.
- [ ] No result is described as MVP-ready from unit tests alone.
