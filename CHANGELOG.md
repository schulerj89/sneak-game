# Changelog

All notable player-facing changes should be recorded here whenever the app version changes.

## Unreleased

- Add upcoming changes here before the next version bump.

## v1.0.0 - 2026-06-16

- Rebuilt the title screen into a full-screen mission command layout with one dominant `Start Run` action and secondary menu controls.
- Added a lightweight animated title-scene operation floor, route line, objective nodes, and sentry sweep using existing Three.js primitives instead of new large assets.
- Added the repo-local `mobile-game-intro-director` skill for future mobile/WebKit title-screen review passes.
- Documented the title-screen refresh decision, screenshots, source research, and performance checks in `docs/2026-06-16-title-screen-refresh/`.

## v0.1.7 - 2026-06-16

- Updated level completion messaging to say `Level X Completed` instead of the old exit/final-game wording.
- Added `AGENTS.md` guidance so future version bumps update this changelog in the same change.

## v0.1.6 - 2026-06-16

- Fixed mobile character select getting stuck while loading the full cinematic hero roster by loading the selected hero first and streaming the rest in the background.
- Added timeout fallback behavior for character-select hero loading so mobile users can still reach the picker if a cinematic GLB is slow.
- Tuned mobile character-select lighting so hero faces remain readable instead of being washed out.
- Updated mobile smoke coverage so character select verifies the selected hero is ready without blocking on every roster asset.
