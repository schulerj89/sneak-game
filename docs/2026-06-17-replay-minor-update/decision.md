# Shadow Circuit Replay Minor Update Decision

Date: 2026-06-17
Status: Recommendation only; no implementation in this pass.
Current version: v2.0.0

## Player Job

When every Mastery Circuit mark is complete, tap one compact replay prompt, get sent to a strong mastered-level target, and confirm progress by beating or defending that level's personal best.

## Chosen Feature

Ship `Encore Pick`: a single Level Select and Goals prompt that appears only when all twelve levels are mastered, chooses one mastered level as the next replay target, and labels the reason as a personal-best chase, for example `Encore: Beat Dock Blackout 0:31`.

The pick should be deterministic for the current browser session or current stored progress snapshot, not calendar-based. Prefer the level with the weakest best-time margin versus par; if margins are tied or missing, fall back to a stable level order. The prompt should start that level directly or focus its card with the existing `Beat best` target visible.

## Why This Fits Shadow Circuit And Mobile Browser Play

- Shadow Circuit already has authored stealth routes, par times, S grades, best times, and Mastery Circuit marks, so `Encore Pick` gives a mastered player a reason to replay without adding new rules or assets.
- A mastered player no longer needs another checklist; they need a fast answer to "what should I run now?" after opening the game on a phone.
- One prompt is better for mobile landscape than adding a dense postgame stats screen, filters, or a calendar contract panel.
- The feature reinforces the current stealth fantasy: clean, repeatable route execution against the player's own record.
- It stays compatible with local browser play because it works offline and can fail softly when storage is unavailable.

## Rejected Alternatives

- Daily contract: good retention shape, but date boundaries, streak expectations, timezone changes, and private-mode storage failures are too much risk for this minor pass.
- Random modifiers: patrol speed, darkness, objective order, or no-HUD variants could add replay value, but they risk breaking authored route validation and mobile readability.
- New postgame medals beyond Mastery Circuit: more badges would be redundant for a player who already mastered every level and would make the Goals panel heavier.
- Online leaderboard: useful for endless mastery, but it introduces network, identity, moderation, privacy, and offline-failure scope that does not fit this local prototype.
- Cosmetic unlocks: stronger reward fantasy, but new skins or visual variants add asset memory, character-select UI, and WebKit loading risk.

## Expected Implementation Scope

- Add a pure helper that receives `LevelDefinition[]` plus `LevelMasteryProgress[]` and returns `null` until all levels are mastered.
- When all levels are mastered, choose one encore target from existing best-time and par-time data, prioritizing the smallest or weakest margin against par.
- Render one compact `Encore Pick` callout in Goals and optionally Level Select; keep the Level Select version to one line plus a familiar `Start` action.
- Reuse existing navigation and level-start paths. Do not add a new scene, level format, asset, audio cue, or per-frame game-state hook.
- Add unit tests for locked state before full mastery, target choice after full mastery, missing best times, tied margins, and blocked storage fallback.
- Extend smoke coverage to seed full mastery, open Goals and Level Select, and verify the prompt fits mobile landscape.

## Data And Storage Risks

- The feature should not require a new storage key; derive the target from existing achievement/mastery records and `shadow-circuit-run-records-v1`.
- If local storage is blocked, corrupt, or empty, hide the encore prompt and leave the normal Level Select and Goals states playable.
- If a level is marked mastered but has a missing best time, treat it as the weakest encore candidate and label the prompt `Encore: Set best time`.
- Avoid calendar or streak state for this pass so Safari private browsing and clock changes cannot make the feature feel broken.
- Keep reads guarded and compute the prompt only while rendering menu overlays, not during gameplay frames.

## Mobile, WebKit, And Performance Risks

- Mobile layout risk: the prompt must not push Goals actions, Level Select cards, Back, or Start below the iPhone landscape safe area.
- WebKit risk: localStorage access can throw; all encore reads must use the same guarded storage pattern already used for mastery and run records.
- Performance risk is low because this is overlay math across twelve levels, but it should still be memoized or computed on overlay render rather than every animation frame.
- Do not add GLBs, textures, generated screenshots, audio, shadows, postprocessing, or extra level preloads.
- Verify that the direct-start action does not conflict with character select, level loading, or existing mobile joystick setup.

## Before/After Screenshot Plan

No screenshots are created in this documentation-only pass. During implementation, capture:

- Before fully mastered Goals mobile: `docs/2026-06-17-replay-minor-update/screenshots/before-goals-mastered-mobile-landscape.png`
- After Goals with `Encore Pick` mobile: `docs/2026-06-17-replay-minor-update/screenshots/after-goals-encore-pick-mobile-landscape.png`
- Before fully mastered Level Select mobile: `docs/2026-06-17-replay-minor-update/screenshots/before-level-select-mastered-mobile-landscape.png`
- After Level Select with `Encore Pick` mobile: `docs/2026-06-17-replay-minor-update/screenshots/after-level-select-encore-pick-mobile-landscape.png`
- Desktop parity: `after-goals-encore-pick-desktop.png` and `after-level-select-encore-pick-desktop.png`
- WebKit parity: `after-goals-encore-pick-webkit-mobile-landscape.png`

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:browser`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:mobile`
- `SMOKE_URL=http://127.0.0.1:<port>/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Seed a fully mastered profile, open Goals, and verify `Encore Pick` appears with a short target.
- Seed partial mastery, open Goals and Level Select, and verify `Encore Pick` stays hidden.
- Seed full mastery with blocked or corrupt storage and verify the game falls back to normal playable menus without console-breaking errors.
- On mobile landscape, tap the encore action and verify the chosen level loads, the joystick remains reachable, and completion still shows the existing Retry Target copy.

## Recommended Version Bump

Ship `Encore Pick` as v2.1.0. It is a minor replay-value addition on top of v2.0.0 because it adds a new mastered-player loop but does not change the core mastery model, level data, assets, or scoring rules.

## Concise Copy Suggestions

- Callout title: `Encore Pick`
- Primary label: `Beat best`
- Full target: `Encore: Beat {level} {time}`
- Missing best time: `Encore: Set best time`
- Completed run, no new best: `Encore still open`
- Completed run, new best: `Encore best updated`
- Empty/fallback state: hide the callout rather than showing error copy.

## Implementation Result

Status: Implemented as v2.1.0.

- Added a pure `Encore Pick` helper that returns `null` until all levels are mastered.
- The helper chooses the smallest best-time margin under par, with missing best times treated as the weakest eligible target.
- Added compact Encore callouts to Goals and Level Select.
- Added a direct `Beat best` / `Set best` action that reuses the existing level-select loading path.
- Kept the feature UI/storage-only: no new assets, levels, audio, or storage keys.

## Screenshot Evidence

- Before fully mastered Goals mobile: `docs/2026-06-17-replay-minor-update/screenshots/before-goals-mastered-mobile-landscape.png`
- Before fully mastered Level Select mobile: `docs/2026-06-17-replay-minor-update/screenshots/before-level-select-mastered-mobile-landscape.png`
- After Goals with Encore Pick mobile: `docs/2026-06-17-replay-minor-update/screenshots/after-goals-encore-pick-mobile-landscape.png`
- After Level Select with Encore Pick mobile: `docs/2026-06-17-replay-minor-update/screenshots/after-level-select-encore-pick-mobile-landscape.png`
- After Goals with Encore Pick desktop: `docs/2026-06-17-replay-minor-update/screenshots/after-goals-encore-pick-desktop.png`
- After Level Select with Encore Pick desktop: `docs/2026-06-17-replay-minor-update/screenshots/after-level-select-encore-pick-desktop.png`
- After Goals with Encore Pick WebKit mobile: `docs/2026-06-17-replay-minor-update/screenshots/after-goals-encore-pick-webkit-mobile-landscape.png`

## Validation Result

- `npm run test:run` passed with 47 tests.
- `npm run test:levels` passed, validating 12 levels and 98 route waypoints.
- `npm run build` passed for v2.1.0.
- `SMOKE_URL=http://127.0.0.1:5214/ npm run test:browser` passed with memory pressure `ok`.
- `SMOKE_URL=http://127.0.0.1:5214/ npm run test:mobile` passed in Chromium mobile emulation.
- `SMOKE_URL=http://127.0.0.1:5214/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile` passed in WebKit mobile emulation.
