# Run Delta Chip Decision

Date: 2026-06-17
Status: Implemented in v2.3.0.
Current version: v2.1.0
Intended version bump: v2.3.0

## Player Job

Finish a run, understand in one glance how the time compares to par or the saved best, and decide whether retrying now is worthwhile.

## Chosen Feature

Ship `Run Delta`: a compact completion-screen chip that turns existing run data into one short comparison line.

The chip should prefer the comparison most useful for the current result:

- New best with previous best: `Best -0:02`
- Behind previous best: `Best +0:03`
- No previous best but under par: `Par -0:05`
- No previous best and over par: `Par +0:04`
- First saved time with no useful comparison: `First time set`

Keep the existing grade, time, par, alerts, score, record note, and Retry Target. The new chip should sit near the record note or inside the run summary without increasing completion-panel height much.

## Implementation Result

`Run Delta` now renders on the completion panel as a compact comparison chip. It prefers previous-best comparison when a saved best exists, falls back to par comparison for first clears, and keeps exact-match labels stable with `Best even` or `Par even`.

## Why It Fits

- Current completion feedback shows raw time, par, score, grade, best note, and Retry Target, but it does not translate the run into a quick margin.
- Mobile replay decisions are stronger when the player can see "I missed best by three seconds" without doing mental math.
- The feature uses `RunSummary`, level par, and existing best-time records; no new storage is required.
- It supports both improving players and mastered players chasing Encore best times.
- It is pure UI and formatting work, so asset, memory, and WebKit risk stay low.

## Rejected Alternatives

- Full split timeline: better training tool, but the game does not track route splits and it would add data-model and UI complexity.
- Ghost replay: high value, but recording/playback introduces storage, input, and visual readability risk.
- Heatmap of detection or movement: useful later, but it needs new telemetry and would be hard to keep compact on phones.
- Medal animations: rewarding, but animation polish is not needed to solve the one-glance comparison job.
- New score formula: changes player expectations and could invalidate existing mastery tuning.

## Implementation Scope

- Add a pure formatter, likely in `src/game/runStats.ts` or `src/game/mastery.ts`, that receives `RunSummary` and returns a short delta label.
- Keep formatting shared with existing `formatRunTime` behavior so `0:02` style remains consistent.
- Render the chip in `src/game/ui.ts` on the complete panel only when a `RunSummary` exists.
- Add `data-testid="run-delta"` for smoke coverage.
- Keep CSS compact: one row, short label, no mobile-only long copy, no animation requirement.
- Add unit tests for new best, slower than best, first under par, first over par, exact best, and exact par.
- Extend browser and mobile smoke tests to seed a previous best, complete a level, and verify the chip text and completion actions remain visible.
- Update `package.json`, `package-lock.json`, and `CHANGELOG.md` only during implementation of v2.3.0.

## Screenshot Plan

Capture before and after completion states in this same decision folder when v2.3.0 is implemented:

- Before completion with existing record note, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/02-before-complete-existing-record-mobile-landscape.png`
- After completion with `Run Delta`, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-complete-mobile-landscape.png`
- After completion with `Run Delta`, desktop: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-complete-desktop.png`
- After first-run par comparison, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-first-run-mobile-landscape.png`
- WebKit parity, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-webkit-mobile-landscape.png`

The after shots should confirm the chip does not push `Next Level`, `Menu`, `Title`, or `Start Over` out of reach.

## Screenshot Evidence

- Desktop after: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-complete-desktop.png`
- Mobile landscape after: `docs/2026-06-17-three-minor-features/screenshots/02-after-run-delta-complete-mobile-landscape.png`

## Validation Result

The formatter is covered by unit tests for faster best, slower best, first clear under par, first clear over par, exact best, and exact par. Browser and mobile smoke tests verify the chip appears on completion and that completion actions remain visible. WebKit mobile smoke also passed.

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:browser`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:mobile`
- `SMOKE_URL=http://127.0.0.1:<port>/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Seed a prior best, complete Dock Blackout slower than that best, and verify `[data-testid="run-delta"]` shows a `Best +...` label.
- Seed a prior best, complete faster if practical through debug timing or helper tests, and verify a `Best -...` case in unit coverage.
- Clear records, complete a level, and verify the chip uses par comparison instead of best comparison.
- Verify mobile completion-panel buttons fit after adding the chip.
- Block or corrupt run-record storage and verify completion still renders a useful par-based delta.
