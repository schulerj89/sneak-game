# Changelog

All notable player-facing changes should be recorded here whenever the app version changes.

## Unreleased

- Add upcoming changes here before the next version bump.

## v2.1.0 - 2026-06-17

- Added `Encore Pick`, a mastered-profile replay prompt that recommends the weakest personal-best target after all Mastery Circuit marks are complete.
- Added compact Encore prompts to Goals and Level Select, with a direct action that loads the recommended level.
- Kept the feature derived from existing mastery and best-time records with no new assets, audio, levels, or storage keys.
- Added unit and smoke coverage for hidden partial-progress state, full-mastery target choice, mobile layout fit, and direct Encore level loading.
- Documented the expert decision and before/after screenshots in `docs/2026-06-17-replay-minor-update/`.

## v2.0.0 - 2026-06-16

- Added `Mastery Circuit` replay progress to Level Select, with per-level marks for Clear, S, Par, and 2x plus the next replay target.
- Added a compact Mastery Circuit summary to Goals so players can see total replay progress at a glance.
- Added `Retry Target` prompts to level-complete screens, guiding the next replay attempt such as S rank, second clear, or best-time chase.
- Added focused unit and smoke coverage for mastery records, retry prompts, desktop Level Select, mobile Level Select, and mobile completion layout.
- Documented the replay-value decision and before/after screenshots in `docs/2026-06-16-replay-value-update/`.

## v1.1.0 - 2026-06-16

- Added the `Clean Entry` goal badge for earning an S grade on any level, including Goals progress and the existing achievement toast.
- Kept achievement toasts visible longer and above completion overlays so badge unlocks are easier to notice on mobile.
- Broadened the repo-local mobile expert skill from title-screen review into `mobile-game-director` for future mobile gameplay, goals, settings, and incentive passes.
- Documented the mobile game update decision and before/after screenshots in `docs/2026-06-16-mobile-game-update/`.

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
