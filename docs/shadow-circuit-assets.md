# Shadow Circuit Assets

The game uses procedural geometry, code-native UI assets, downloaded external music tracks, and reusable GLB props:

- Player: Memory first and Balanced use the teal capsule mesh; Cinematic preloads the selected supplied hero GLBs from `src/assets/hero/` and blends idle/Run_02 animation clips.
- Guards: Memory first and Balanced use red cone meshes; Cinematic preloads the supplied static sentry GLB from `src/assets/characters/sentry/enemy_sentry.glb`, then applies hover motion and front spotlight tracking in code.
- Vision: transparent cone geometry.
- Cover: box meshes sized per level.
- Goal: emissive green cylinder.
- Objectives: Memory first and Balanced use simple runtime geometry; Cinematic preloads small GLB keycard and terminal props from `src/assets/objectives/`.
- Characters: Cinematic preloads hero idle/Run_02 GLBs from the roster in `src/game/heroes.ts` and the supplied enemy sentry GLB from `src/assets/characters/sentry/`.
- Character references: generated PNG concept images live under `src/assets/characters/reference/` and are the source inputs for Meshy Image to 3D.
- Music: downloaded external tracks in `src/assets/`, with a separate title/character-select track and per-level gameplay assignments.

## Meshy Objective Assets

The project-local Meshy MCP config lives in `.codex/config.toml`. It does not commit an API key; launch Codex with `MESHY_API_KEY` set when you want the MCP server to call Meshy. Real asset generation uses:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-objectives
```

The script writes `keycard-cinematic.glb` and `terminal-cinematic.glb` only after confirming each output is under the configured asset-size budget. Use `MESHY_TEST_MODE=true` to exercise API plumbing without overwriting runtime assets.

## Meshy Character Assets

The character pipeline uses generated 2D references first, then Meshy Image to 3D, rigging, and animation:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-characters
```

Useful character-only switches:

```powershell
npm run assets:meshy-characters -- --only=hero
npm run assets:meshy-characters -- --only=sentry
npm run assets:meshy-characters -- --skip-rigging
npm run assets:meshy-characters -- --skip-animation
```

Without a Meshy key, the fallback path writes lightweight local GLBs that match the intended hero and sentry silhouettes:

```powershell
$env:MESHY_CHARACTER_FALLBACK = "true"
npm run assets:meshy-characters
```

The runtime still falls back to the original procedural meshes outside Cinematic quality, so Memory first remains the safest path on constrained devices. The current production character GLBs are intentionally much larger than the old fallback assets because they preserve high-detail texture and skeletal animation data.

## Supplied Hero Runtime

The supplied hero package is kept in extracted runtime form under:

```text
src/assets/hero/Meshy_AI_a_small_tactical_chib_biped/
```

Only these GLBs are loaded by the runtime:

- `Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb`
- `Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb`

Use `npm run debug:hero-animation` to verify the close-up hero camera, idle-to-run transition, return-to-idle transition, and movement-facing yaw. The script writes screenshots to `artifacts/hero-debug-*.png`.

The title and character-select screens also use the selected cinematic hero GLB in its idle state. It renders inside the Three.js scene on a black title background instead of using a static image or showing level one behind the menu.

## Enemy Sentry Runtime

The current sentry runtime asset is:

```text
src/assets/characters/sentry/enemy_sentry.glb
```

The asset has no embedded animation clips. Cinematic mode reuses the same model for every guard, while `Game.ts` keeps the old front-facing light cone, patrol yaw, and detection logic. The sentry body hovers above the floor with a slow vertical bob while it moves forward and backward on patrol. Its visible lens and spotlight origin sit near the upper front of the body so the light source reads from the head area.

Use `npm run debug:enemy-sentry` to verify the close-up sentry camera, hover range, patrol movement, yaw-to-facing alignment, spotlight-to-facing alignment, and high/front spotlight origin. The script writes screenshots to `artifacts/enemy-debug-sentry-*.png`.
