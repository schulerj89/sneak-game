# Next Run Shortcut Decision

Date: 2026-06-17
Status: Implemented in v2.2.0.
Current version: v2.1.0
Intended version bump: v2.2.0

## Player Job

Open the title screen, see the best next replay target immediately, tap one compact action, and confirm progress by landing in the recommended level.

## Chosen Feature

Ship `Next Run`: a compact title-screen shortcut that appears after the player has any stored progress and points to the most useful current target from existing Mastery Circuit data.

For partial progress, choose the first level with unfinished mastery marks and show its current `nextTarget`, for example `Next: Reactor Core - Replay for S`. For fully mastered profiles, reuse the existing `Encore Pick` target and copy, for example `Encore: Archive Lanes - Beat best`. The action label should stay short: `Run`.

Hide the shortcut for brand-new profiles so the current `Start Run` flow remains the clean first-session path.

## Implementation Result

`Next Run` now appears on the title screen only after stored progress exists. Partial profiles point at the first unfinished mastery level and its current target, while fully mastered profiles reuse the existing Encore Pick. The `Run` action uses the same level-loading path as manual level select, so mobile and desktop behavior stay consistent.

## Why It Fits

- Shadow Circuit already has Mastery Circuit, Retry Target, and Encore Pick; this makes the title screen answer "what should I do now?" without adding a new system.
- Mobile landscape players should not need to open Goals, scan twelve level cards, then choose a route every time they return for a short session.
- The feature reuses current clears, grades, best times, per-level targets, and the existing level-loading path.
- It adds no assets, audio, level geometry, WebGL effects, or new persistent records.
- It fits WebKit constraints because progress reads already use guarded localStorage paths and the UI is a small title-panel addition.

## Rejected Alternatives

- Daily target: stronger retention language, but calendar boundaries, timezone changes, and Safari private-mode storage behavior add avoidable risk.
- Title-screen achievement grid: duplicates Goals, increases first-screen density, and makes mobile landscape harder to scan.
- Random level button: fast, but less useful than a deterministic target tied to actual progress.
- Auto-resume the last played level: convenient, but it may ignore the most valuable current mastery target.
- New title-scene animation for the target: visible, but it adds rendering/performance work that is not needed for the player job.

## Implementation Scope

- Add a pure helper, likely near `src/game/mastery.ts`, that returns a `NextRunTarget | null` from `levels`, `levelMastery`, and `encorePick`.
- Choose no target for empty progress; choose the first incomplete mastery level for partial progress; choose the existing `Encore Pick` for complete mastery.
- Pass the target into `GameUi.renderOverlay` for the title phase.
- Render one compact `next-run` strip inside the title command stack below the primary button or between primary and secondary actions.
- Wire the strip action to the existing level-select loading path through the current `onSelectLevel` callback or an equivalent title action.
- Keep copy to one title, one truncated target line, and one `Run` button.
- Add unit tests for empty progress, partial progress, full mastery, missing best time, and stable tie behavior.
- Extend browser and mobile smoke tests to seed partial progress, verify the title shortcut fits mobile landscape, tap `Run`, and verify the target level loads.
- Update `package.json`, `package-lock.json`, and `CHANGELOG.md` only during implementation of v2.2.0.

## Screenshot Plan

Capture before and after states in this same decision folder when v2.2.0 is implemented:

- Before title with seeded partial progress, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/01-before-title-partial-progress-mobile-landscape.png`
- After title with `Next Run`, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-mobile-landscape.png`
- After title with `Next Run`, desktop: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-desktop.png`
- After title with full-mastery Encore target, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-encore-mobile-landscape.png`
- WebKit parity, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-webkit-mobile-landscape.png`

The after shots should show that `Start Run`, `Levels`, `Goals`, `Settings`, and the version badge still fit inside the iPhone landscape safe area.

## Screenshot Evidence

- Desktop after: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-desktop.png`
- Mobile landscape after: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-mobile-landscape.png`
- Mobile landscape mastered Encore state: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-encore-mobile-landscape.png`
- WebKit mobile landscape after: `docs/2026-06-17-three-minor-features/screenshots/01-after-next-run-title-webkit-mobile-landscape.png`

## Validation Result

The helper is covered by unit tests for empty, partial, and mastered profiles. Browser and mobile smoke tests seed progress, verify the shortcut text, tap `Run`, and confirm the expected level loads. WebKit mobile smoke also passed.

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:browser`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:mobile`
- `SMOKE_URL=http://127.0.0.1:<port>/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Seed no progress and verify the title shortcut is hidden.
- Seed partial progress with one incomplete level and verify `Next Run` names that level and target.
- Seed full mastery and verify the shortcut mirrors the existing Encore target.
- Tap `Run` on mobile landscape and verify loading starts, the selected level id matches the target, and touch controls appear without overlap.
- Corrupt or block localStorage and verify the title falls back to the normal playable first-session state.
