# Shadow Circuit Replay Value Update Decision

Date: 2026-06-16
Status: Recommendation only; no implementation in this pass.
Current version: v1.1.0

## Chosen Major Update

Ship `Mastery Circuit`: turn Level Select into the replay hub by showing per-level mastery marks for clear, best grade, best time versus par, and second clear progress, with one compact next-target line per level card.

Player job: Pick a level with an unfinished mastery mark, replay it for one visible improvement, and confirm progress when the card updates.

## Chosen Minor Update

Ship `Retry Target`: add one context-aware replay prompt on the level-complete screen, such as `Retry for S`, `Beat best: 00:31`, or `Second clear ready`, using the current run summary and existing records.

Player job: Finish a level, read the next best replay target in under three seconds, and tap Retry or Next with confidence.

## Why These Fit Mobile Browser Play

- `Mastery Circuit` reuses the existing twelve-level grid, best times, grades, clears, Goals, and generated level thumbnails, so replay value comes from clearer progress rather than new scenes or assets.
- `Mastery Circuit` works for short mobile sessions because each card can answer "what should I replay next?" without opening a dense stats screen.
- `Retry Target` improves the moment when replay intent is highest and does not add another menu, gesture, or long explanation.
- Both updates keep touch actions familiar: Level Select, Retry, Next, Goals, and Back remain the main controls.

## Rejected Alternatives

- Daily contracts: strong replay fantasy, but date resets, streak edge cases, and private-mode storage failures are higher risk than per-level mastery.
- Procedural patrol or objective modifiers: could break the route validator, undermine authored stealth timing, and raise WebKit/debug complexity.
- New levels as the main replay update: valuable later, but the current twelve levels need clearer mastery goals before more content.
- Cosmetic unlocks: appealing reward layer, but new character skins or props add asset, memory, and selection UI risk.
- Online leaderboards or cloud saves: too much network, privacy, and offline-failure surface for the current local browser game.

## Expected Implementation Scope

`Mastery Circuit`:

- Add a small level-mastery model that merges existing best-time records with achievement clear and best-grade records, or migrate both into a guarded `shadow-circuit-progress-v2` key.
- Update Level Select cards with short mastery chips: `Clear`, `S`, `Best`, `2x`, plus one next-target line.
- Keep Goals global, but add a compact aggregate mastery count only if it fits the existing panel without pushing actions offscreen.
- Add unit tests for progress loading, migration/fallback, target selection, and blocked-storage behavior.
- Extend browser and mobile smoke tests to seed progress, open Level Select, and verify compact mastery states on desktop, Chromium mobile, and WebKit mobile.

`Retry Target`:

- Add a pure helper that chooses one completion prompt from `RunSummary`, level par, best time, grade, and clear count.
- Render the prompt in the complete panel near the grade and record note, with copy short enough for mobile landscape.
- Optionally relabel the Retry button from `Retry` to the chosen action when the label stays short.
- Add unit tests for S-grade, non-S-grade, new-best, no-record, and second-clear cases.
- Extend smoke coverage to complete a level and verify the prompt does not cover completion actions.

## Storage, Performance, And WebKit Risks

- Storage: `Mastery Circuit` touches record shape; use guarded reads/writes, ignore corrupt entries, preserve existing v1 best times and achievement records, and show empty mastery when storage is unavailable.
- Storage: `Retry Target` should not require a new key; it can read current summary plus existing records and degrade to `Retry for S`.
- Performance: both updates are overlay work only; compute mastery when rendering Level Select or completion, not per frame.
- Performance: no new GLBs, textures, audio, shadows, postprocessing, or level loads should be introduced.
- WebKit: verify compact chips and prompt copy in iPhone landscape safe areas, especially that Back/Retry/Next buttons remain reachable.
- WebKit: test private/quota-limited storage fallback so completion never blocks on `localStorage`.

## Before/After Screenshot Plan

No screenshots are created in this decision pass. During implementation, capture:

- Before Level Select mobile: `docs/2026-06-16-replay-value-update/screenshots/before-level-select-mobile-landscape.png`
- After `Mastery Circuit` Level Select mobile: `docs/2026-06-16-replay-value-update/screenshots/after-mastery-level-select-mobile-landscape.png`
- Before completion mobile: `docs/2026-06-16-replay-value-update/screenshots/before-complete-mobile-landscape.png`
- After `Retry Target` completion mobile: `docs/2026-06-16-replay-value-update/screenshots/after-retry-target-complete-mobile-landscape.png`
- Desktop parity: `before-level-select-desktop.png`, `after-mastery-level-select-desktop.png`, `before-complete-desktop.png`, and `after-retry-target-complete-desktop.png`.
- WebKit parity: at least `after-mastery-level-select-webkit-mobile-landscape.png` and `after-retry-target-complete-webkit-mobile-landscape.png`.

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:browser`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:mobile`
- `SMOKE_URL=http://127.0.0.1:<port>/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Manual mobile check: seed progress, open Level Select, confirm mastery chips fit; complete a level, confirm the retry prompt and achievement toast do not cover joystick, HUD chips, Retry, Next, or Back.
- Storage fallback check: block or corrupt local storage, reload, open Level Select and complete a level, and confirm playable defaults render without console-breaking errors.

## Recommended Version Bump

- Minor update: ship `Retry Target` as v1.2.0.
- Major update: ship `Mastery Circuit` as v2.0.0 because it changes the persistent replay-progress model and makes Level Select the primary mastery hub.

## Implementation Result

Status: Implemented as v2.0.0.

- Added `Mastery Circuit` level-card marks for `Clear`, `S`, `Par`, and `2x`.
- Added one `next target` line per level card so players can choose a replay goal quickly.
- Added a compact `Mastery Circuit` aggregate to Goals.
- Added `Retry Target` copy to completion screens using the current run summary and updated stored progress.
- Kept the change UI/storage-only: no new GLBs, textures, audio, level geometry, or per-frame progress reads.

## Screenshot Evidence

- Before Level Select desktop: `docs/2026-06-16-replay-value-update/screenshots/before-level-select-desktop.png`
- Before Level Select mobile: `docs/2026-06-16-replay-value-update/screenshots/before-level-select-mobile-landscape.png`
- Before completion desktop: `docs/2026-06-16-replay-value-update/screenshots/before-complete-desktop.png`
- Before completion mobile: `docs/2026-06-16-replay-value-update/screenshots/before-complete-mobile-landscape.png`
- After Mastery Circuit Level Select desktop: `docs/2026-06-16-replay-value-update/screenshots/after-mastery-level-select-desktop.png`
- After Mastery Circuit Level Select mobile: `docs/2026-06-16-replay-value-update/screenshots/after-mastery-level-select-mobile-landscape.png`
- After Retry Target completion desktop: `docs/2026-06-16-replay-value-update/screenshots/after-retry-target-complete-desktop.png`
- After Retry Target completion mobile: `docs/2026-06-16-replay-value-update/screenshots/after-retry-target-complete-mobile-landscape.png`
- After Mastery Circuit WebKit mobile: `docs/2026-06-16-replay-value-update/screenshots/after-mastery-level-select-webkit-mobile-landscape.png`
- After Retry Target WebKit mobile: `docs/2026-06-16-replay-value-update/screenshots/after-retry-target-complete-webkit-mobile-landscape.png`

## Validation Result

- `npm run test:run` passed with 43 tests.
- `npm run test:levels` passed, validating 12 levels and 98 route waypoints.
- `npm run build` passed for v2.0.0.
- `SMOKE_URL=http://127.0.0.1:5212/ npm run test:browser` passed at 60 FPS with memory pressure `ok`.
- `SMOKE_URL=http://127.0.0.1:5212/ npm run test:mobile` passed in Chromium mobile emulation.
- `SMOKE_URL=http://127.0.0.1:5212/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile` passed in WebKit mobile emulation.
