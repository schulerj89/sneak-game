# Changelog

All notable player-facing changes should be recorded here whenever the app version changes.

## Unreleased

- Add upcoming changes here before the next version bump.

## v0.1.7 - 2026-06-16

- Updated level completion messaging to say `Level X Completed` instead of the old exit/final-game wording.
- Added `AGENTS.md` guidance so future version bumps update this changelog in the same change.

## v0.1.6 - 2026-06-16

- Fixed mobile character select getting stuck while loading the full cinematic hero roster by loading the selected hero first and streaming the rest in the background.
- Added timeout fallback behavior for character-select hero loading so mobile users can still reach the picker if a cinematic GLB is slow.
- Tuned mobile character-select lighting so hero faces remain readable instead of being washed out.
- Updated mobile smoke coverage so character select verifies the selected hero is ready without blocking on every roster asset.
