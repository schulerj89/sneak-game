# Shadow Circuit Mobile Game Update Decision

Date: 2026-06-16
Status: Implemented in v1.1.0

## Chosen Feature

Add a first-S-grade badge: `Clean Entry`.

The badge unlocks when the player earns an `S` grade on any level. It should appear in the existing Goals panel and use the existing achievement toast on unlock.

## Player Job

Finish any level under par without alerts to earn the first `S` badge and confirm that a cleaner route is possible.

## Why It Fits Mobile Browser Play

- It gives mobile players a clear short-session replay target without asking them to read a long goal list.
- It reuses the current grade, par-time, alert, Goals, and achievement-toast systems.
- It does not add art, audio, extra WebGL work, or a new menu.
- It makes the existing `S` grade more meaningful before the long-term `Perfect Shadow` all-level badge becomes realistic.

## Rejected Alternatives

- Daily contracts: higher scheduling and storage risk for a browser prototype, plus extra copy and reset-state edge cases on mobile Safari.
- Settings reward or preset: useful accessibility work, but it does not make the next run more rewarding.
- Per-level badge grid: good long-term, but too much UI density for iPhone landscape and likely needs filtering.
- Cosmetic unlocks: stronger reward fantasy, but it adds asset, memory, and menu complexity beyond a minor update.

## Expected Implementation Scope

- Extend `AchievementId` with `clean-entry`.
- In `buildAchievementProgress`, count levels whose stored `bestGrade` is `S`; set progress to `1` when any level qualifies and target to `1`.
- Add copy: title `Clean Entry`, description `Earn an S grade on any level.`
- Keep the current `shadow-circuit-achievements-v1` record shape; no migration or new storage key should be needed.
- Add or update achievement unit tests for first-S unlock, repeat clears, and storage-disabled fallback.
- No new screenshots, assets, game levels, package metadata, or changelog entries in the decision step.

## Before/After Screenshot Plan

No screenshots are created in this decision pass. During implementation, capture the same desktop and mobile-landscape states before and after:

- Before Goals panel: `docs/2026-06-16-mobile-game-update/screenshots/before-goals-mobile-landscape.png`
- Before level complete: `docs/2026-06-16-mobile-game-update/screenshots/before-complete-mobile-landscape.png`
- After Goals panel with `Clean Entry`: `docs/2026-06-16-mobile-game-update/screenshots/after-goals-mobile-landscape.png`
- After unlock toast on level complete: `docs/2026-06-16-mobile-game-update/screenshots/after-clean-entry-toast-mobile-landscape.png`
- Optional desktop parity: `before-goals-desktop.png` and `after-goals-desktop.png`

## Performance, WebKit, And Storage Risks

- Performance risk is low: the Goals panel grows from three cards to four, and no per-frame work should be added.
- WebKit risk is mainly layout: verify the fourth card does not overflow compact landscape panels or hide the Back button.
- Storage risk is low because it reuses existing achievement records and existing guarded `localStorage` reads/writes.
- If storage is blocked or empty, the badge should render as `0 / 1` and normal play should continue.
- Keep all copy short so mobile CSS can continue hiding descriptions where needed.

## Smoke-Test Plan

- `npm run test:run`
- `npm run test:mobile`
- `MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
- Manual or browser-smoke setup: seed or earn one `S` clear, open Goals, confirm `Clean Entry` shows `Done`, and confirm the achievement toast does not cover the joystick, objective chips, or completion actions in mobile landscape.

## Implementation Result

- Added `clean-entry` to the existing achievement progress model without changing the `shadow-circuit-achievements-v1` storage shape.
- Added unit coverage for first-S unlock behavior and storage-disabled fallback rendering.
- Updated desktop and mobile smoke assertions so the Goals panel expects four rows and verifies `Clean Entry`.
- Raised achievement toasts above overlays and extended their visibility to 8 seconds so mobile unlock feedback is readable.
- Bumped the app version to `1.1.0` and recorded the change in `CHANGELOG.md`.

## Captured Screenshots

- Before desktop Goals panel: `docs/2026-06-16-mobile-game-update/screenshots/before-goals-desktop.png`
- Before mobile Goals panel: `docs/2026-06-16-mobile-game-update/screenshots/before-goals-mobile-landscape.png`
- After mobile Clean Entry toast: `docs/2026-06-16-mobile-game-update/screenshots/after-clean-entry-toast-mobile-landscape.png`
- After mobile Goals panel with Clean Entry complete: `docs/2026-06-16-mobile-game-update/screenshots/after-goals-mobile-landscape.png`
- After desktop Goals panel: `docs/2026-06-16-mobile-game-update/screenshots/after-goals-desktop.png`

## Validation Run

- `npm run test:run` passed.
- `npm run build` passed.
- `SMOKE_URL=http://127.0.0.1:5210/ npm run test:browser` passed at about 60 FPS with memory pressure OK.
- `SMOKE_URL=http://127.0.0.1:5210/ npm run test:mobile` passed in Chromium.
- `SMOKE_URL=http://127.0.0.1:5210/ MOBILE_SMOKE_BROWSER=webkit npm run test:mobile` passed in WebKit.
- `quick_validate.py .codex/skills/mobile-game-director` passed.
