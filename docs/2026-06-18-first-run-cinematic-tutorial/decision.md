# First-Run Cinematic Tutorial Decision

Date: 2026-06-18
Current version: v2.7.0
Target version: v2.8.0
Implemented version: v2.8.0

## Feature

Add a desktop-only first-run cinematic tutorial after operative selection. It teaches the selected hero, sentries, objectives, and exit goal with close-up camera shots and bottom captions, then ends with `Good luck, cadet.` and starts gameplay.

## Trigger

Show the cinematic only when all of these are true:

- Desktop-capable viewport with fine pointer and minimum space for cinematic framing.
- Normal `Start Run -> Select Operative -> Start Level` path for level 1.
- No saved level progress in `shadow-circuit-achievements-v1` or `shadow-circuit-run-records-v1`.
- No `shadow-circuit-first-run-tutorial-v1` seen flag.

Keep the existing static briefing for mobile, compact landscape, existing-progress profiles, direct level select, retries, start over, and storage-failure fallback.

## Expert Decisions

### Game Direction

- Replace the static first-level briefing only for true desktop first-run profiles.
- Run the cinematic after level loading and warmup but before `beginRun()`, so timer, detection, input, HUD, touch controls, and objective pickup logic do not start early.
- Use short staged captions: hero, sentry, keycard, terminal, goal, final `Good luck, cadet.`.
- End on the normal level camera to avoid a jarring handoff.

### Three.js Rendering

- Add a non-playing `tutorial` phase and reuse the loaded gameplay scene, `PerspectiveCamera`, player, enemies, objectives, and goal.
- Do not create a second scene, duplicate GLBs, add postprocessing, or use Three.js text meshes.
- Drive the camera from runtime refs: `playerMesh`, first sentry runtime, objective runtimes, `goalMesh`, and `goalBeaconMesh`.
- Use DOM captions over the canvas and update resize handling so cinematic framing is not stomped.

### Screenshot QA

- Add desktop browser smoke that asserts shot order, bottom caption visibility, selected hero close-up, sentry close-up, objective close-ups, goal/final copy, and final handoff to `playing`.
- Add mobile negative coverage that the cinematic does not appear and the existing simplified briefing remains.
- Capture versioned evidence screenshots in this folder.

## Screenshot Evidence Plan

- `screenshots/01-tutorial-hero-closeup-desktop.png`
- `screenshots/02-tutorial-sentry-closeup-desktop.png`
- `screenshots/03-tutorial-keycard-terminal-closeup-desktop.png`
- `screenshots/03b-tutorial-terminal-closeup-desktop.png`
- `screenshots/04-tutorial-goal-closeup-desktop.png`
- `screenshots/05-tutorial-good-luck-desktop.png`

## Implementation Notes

- The cinematic is a `tutorial` phase that runs after `loadLevelWithTransition()` and before `beginRun()`.
- The tutorial uses the already-loaded level scene and moves the shared camera between runtime object refs.
- `shadow-circuit-first-run-tutorial-v1` is written as soon as the cinematic starts so it cannot repeat after refreshes or a mid-tutorial exit.
- Debug hooks expose tutorial state and deterministic shot selection for smoke screenshots.

## Validation Plan

- `npm run test:run`
- `npm run test:levels`
- `npm run build`
- `npm run test:browser`
- `npm run test:mobile` with Chromium
- `npm run test:mobile` with WebKit

## Validation Results

- PASS: `npm run test:run`
- PASS: `npm run test:levels`
- PASS: `npm run build`
- PASS: `npm run test:browser`
- PASS: `npm run test:mobile` with Chromium
- PASS: `npm run test:mobile` with WebKit
