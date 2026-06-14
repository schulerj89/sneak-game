# Shadow Circuit Shaders

Shadow Circuit now uses lightweight custom shaders for atmosphere and readability.

## Floor Shader

`src/game/shaders.ts` defines `createFloorShaderMaterial()`.

The floor shader adds:

- World-space grid lines.
- Subtle diagonal hatch texture.
- Distance-based vignette darkening.

This keeps the dark-room style but makes floor depth and movement lanes easier to read.

## Goal Beacon Shader

`createGoalBeaconMaterial()` drives the translucent green exit beacon.

The beacon is shader-based so it stays visible without relying only on standard lighting. It also gives each goal a stronger readable silhouette in darker rooms.

## Contact Shadows

`createContactShadowMaterial()` creates soft circular shadow decals under the player and guards.

These contact shadows improve grounding for moving entities without expensive post-processing or additional shadow passes.

## Refactor

Shader and geometry creation moved out of `Game.ts` into `src/game/shaders.ts`. This keeps the main runtime focused on game state and level orchestration.

## Performance

Cinematic mode now reserves additional memory, increases shadow-map resolution, and preloads objective GLBs while staying under the `192 MB` advisory cap in browser smoke testing.
