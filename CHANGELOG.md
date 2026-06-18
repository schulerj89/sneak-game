# Changelog

All notable player-facing changes should be recorded here whenever the app version changes.

## Unreleased

- Add upcoming changes here before the next version bump.

## v2.9.2 - 2026-06-18

- Brightened cinematic keycard and terminal pickups with stronger load-time emissive material treatment and a lightweight additive glow halo.
- Kept the glow path cheap by avoiding bloom/postprocessing and disabling objective glow shadows.

## v2.9.1 - 2026-06-18

- Replaced cinematic keycard and terminal pickups with new Meshy image-to-3D textured/remeshed GLBs generated from committed reference PNGs.
- Preserved lightweight primitive objective fallbacks for memory-safe mobile/iPad quality.
- Added Meshy metadata, accepted previews, and updated objective asset validation for the new detailed GLB budget.

## v2.9.0 - 2026-06-18

- Added versioned feature-seen tracking so the cinematic tutorial can show once per introduced app version and then stay dismissed.
- Expanded the cinematic tutorial to tablet-sized iPad landscape viewports while keeping phone-sized mobile starts direct and briefing-free.
- Added a Settings `Clear Data` action for progress, records, and feature-seen flags.
- Kept title music playing while Settings is open from the title screen, even when changing soundtrack selection.

## v2.8.0 - 2026-06-18

- Added a desktop-only first-run cinematic tutorial for fresh profiles after operative selection, with close-ups on the chosen hero, sentry, keycard, terminal, and exit.
- Kept mobile, returning-player, level-select, retry, and storage-fallback flows on the existing lightweight briefing or direct run paths.
- Added debug hooks and smoke screenshot coverage for deterministic tutorial shot verification.

## v2.7.0 - 2026-06-18

- Instanced Intel Pulse markers, beacons, and waypoints to reduce transient overlay meshes and draw-call growth.
- Added unit and desktop/mobile smoke coverage for the instanced Intel Pulse visual budget.

## v2.6.0 - 2026-06-18

- Precompiled level and Intel Pulse materials asynchronously during loading with Three.js `compileAsync`.
- Added smoke coverage that verifies shader warmup passes complete before the first playable frame sample.

## v2.5.0 - 2026-06-18

- Moved the game loop to Three.js renderer-owned animation scheduling with `setAnimationLoop`.
- Added smoke coverage that verifies render frames, draw calls, and triangles continue advancing during play.
- Added a repo-local Three.js rendering expert skill grounded in official Three.js rendering, Object3D, material, and instancing docs.

## v2.4.6 - 2026-06-17

- Sanitized stored boolean settings and invalid volume values so corrupted browser storage falls back to defaults instead of changing runtime behavior.
- Added focused settings storage tests for malformed saved settings and blocked localStorage writes.

## v2.4.5 - 2026-06-17

- Scoped quality rebuilds so title/settings changes refresh the title hero preview without spawning level objectives, blockers, enemies, or exits.
- Added smoke coverage and screenshot evidence for title-screen quality changes.

## v2.4.4 - 2026-06-17

- Guarded rapid `Start Run` taps by entering the hero-roster loading transition before any async menu audio work.
- Added desktop and mobile smoke coverage for double-clicking/tapping `Start Run`.

## v2.4.3 - 2026-06-17

- Cleared keyboard and virtual movement input on window blur or hidden-document transitions so controls cannot drift after focus loss.
- Added focused input tests for focus-loss cleanup.

## v2.4.2 - 2026-06-17

- Hardened desktop smoke tests with a Shadow Circuit preflight, configurable playing timeout, and richer phase/loading diagnostics.
- Replaced hardcoded smoke level counts with values derived from the level registry.
- Removed the extra level-ready delay after the required loading duration to prevent transitions from lingering on `Ready`.

## v2.4.1 - 2026-06-17

- Stabilized Intel Pulse mobile controls by updating the existing button in place instead of replacing its DOM each HUD refresh.
- Kept the mobile pulse button tappable during live status, charge, cooldown, and meter updates.

## v2.4.0 - 2026-06-17

- Added `Detected Retry Target`, a compact detected-screen reminder of the current level's open mastery target.
- Kept the retry flow focused on `Retry Level` and `Settings` while making failed attempts point back to the next improvement.
- Added smoke coverage for the caught-state target line and mobile button fit.

## v2.3.0 - 2026-06-17

- Added `Run Delta`, a completion-screen chip that compares the run time against saved best or par.
- Added shared delta formatting for best-time wins, misses, exact matches, and first-run par comparisons.
- Added unit and smoke coverage for the new completion feedback.

## v2.2.0 - 2026-06-17

- Added `Next Run`, a title-screen shortcut that recommends the next useful mastery or Encore target once progress exists.
- Kept brand-new profiles on the clean `Start Run` flow while giving returning players a one-tap route back into replay.
- Added unit and smoke coverage for partial-progress and mastered-profile title shortcuts.

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
