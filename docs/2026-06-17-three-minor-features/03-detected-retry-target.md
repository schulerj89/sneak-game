# Detected Retry Target Decision

Date: 2026-06-17
Status: Implemented in v2.4.0.
Current version: v2.1.0
Intended version bump: v2.4.0

## Player Job

Get detected, see the current level's unfinished replay target immediately, tap Retry Level, and know what improvement to attempt next.

## Chosen Feature

Ship `Detected Retry Target`: a compact line on the detected panel that reuses the current level's Mastery Circuit `nextTarget`.

Example copy:

- `Still open: Replay for S`
- `Still open: Beat par 0:32`
- `Still open: Second clear ready`
- `Still open: Beat best 0:31`

The detected panel should remain focused on recovery: title, one short explanation, the target line, `Retry Level`, and `Settings`.

## Implementation Result

`Detected Retry Target` now appears on the caught panel when current mastery data is available. It reuses the current level's `nextTarget`, so failed runs point directly at the next useful retry goal without adding new storage or rules.

## Why It Fits

- The current detected panel explains failure but does not connect the retry to the player's active mastery goal.
- A failed stealth attempt is the highest-friction moment on mobile; one target line makes Retry feel purposeful instead of punitive.
- The feature reuses existing per-level mastery state and copy, avoiding new progression rules or storage.
- It works for new players, mastery chasers, and mastered players because `nextTarget` already adapts to current progress.
- It avoids rendering and asset risk by touching only an overlay that is already hidden during gameplay.

## Rejected Alternatives

- Checkpoints after detection: easier recovery, but it changes level tension and route validation assumptions.
- Hint arrows or safe-path overlays: useful onboarding, but they add in-level rendering complexity and can obscure small mobile play space.
- Slow-motion detection replay: attractive feedback, but it requires input/state recording and extra animation handling.
- Haptic failure feedback: mobile-friendly in theory, but WebKit support and user gesture constraints make it inconsistent.
- New failed-run stats panel: more information, but it would crowd the detected overlay and delay Retry.

## Implementation Scope

- Find the current `LevelMasteryProgress` in `Game` when rendering non-playing overlays, or pass the full mastery list and current level id into the caught panel.
- Render one `caught-target` element on the detected panel using the current level's `nextTarget`.
- Add `data-testid="caught-target"` for smoke coverage.
- Keep copy short and hide the line only if mastery data is unavailable.
- Do not add storage, new progress math, new level state, new sound, or new visual effects.
- Add unit coverage only if a small helper is introduced; otherwise rely on smoke coverage plus existing mastery tests.
- Extend browser and mobile smoke tests to force caught state from seeded progress and verify the target line appears without covering actions.
- Update `package.json`, `package-lock.json`, and `CHANGELOG.md` only during implementation of v2.4.0.

## Screenshot Plan

Capture before and after detected states in this same decision folder when v2.4.0 is implemented:

- Before detected panel, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/03-before-detected-mobile-landscape.png`
- After detected panel with `Detected Retry Target`, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-retry-target-mobile-landscape.png`
- After detected panel with `Detected Retry Target`, desktop: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-retry-target-desktop.png`
- After detected panel with a seeded `Beat best` target, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-beat-best-mobile-landscape.png`
- WebKit parity, mobile landscape: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-retry-target-webkit-mobile-landscape.png`

The after shots should confirm `Retry Level` and `Settings` remain visible and reachable above the landscape safe-area edge.

## Screenshot Evidence

- Desktop after: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-retry-target-desktop.png`
- Mobile landscape after: `docs/2026-06-17-three-minor-features/screenshots/03-after-detected-retry-target-mobile-landscape.png`

## Validation Result

Browser and mobile smoke tests force the detected state from seeded progress and verify the retry target line remains visible with the action buttons in reach. WebKit mobile smoke also passed.

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:browser`
- `SMOKE_URL=http://127.0.0.1:<port>/ npm run test:mobile`
- `SMOKE_URL=http://127.0.0.1:<port>/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Seed a partial profile where Dock Blackout needs `Replay for S`, force caught through `window.__shadowCircuitDebug.forceCaught()`, and verify `[data-testid="caught-target"]` includes `Replay for S`.
- Seed a mastered Dock Blackout profile with a best time and force caught, then verify the line can show `Beat best`.
- Tap `Retry Level` on mobile landscape and verify loading starts, the same level returns to playing phase, and joystick/HUD layout remains intact.
- Open `Settings` from the detected panel and back out to confirm the target panel flow still restores correctly.
- Corrupt or block storage and verify the detected panel still shows Retry/Settings and does not throw.
