# Shadow Circuit 06-14-2026 Character Asset Refresh

## Decision

Replace the small procedural-style cinematic character GLBs with higher-detail Meshy Image-to-3D assets generated from committed reference images. Keep the original simple meshes as the Memory first and Balanced fallback.

## Reference Images

The character source images were generated first and saved in the repo:

- `src/assets/characters/reference/shadow-circuit-hero-reference.png`
- `src/assets/characters/reference/shadow-circuit-sentry-reference.png`

These references use front-facing humanoid A-pose-style silhouettes with separated limbs, clear armor materials, strong visor color, and flat neutral backgrounds so Meshy rigging has a cleaner input than a text-only model request.

## Meshy Path

The character script now uses Meshy's Image to 3D endpoint, followed by rigging and animation where possible:

- Image to 3D: `POST /openapi/v1/image-to-3d`
- Rigging: `POST /openapi/v1/rigging`
- Animation: `POST /openapi/v1/animations`

The selected Meshy-generated animation actions were:

- Sentry: `2` / `Alert` from Meshy's animation library for generated experiments. The active sentry was later replaced by the supplied static `enemy_sentry.glb`.

The output budget is now `90 MB` per character so detailed textures and animation data are allowed.

## Outputs

- `src/assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb`: active hero idle clip, about `12.2 MB`.
- `src/assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb`: active hero run clip, about `12.1 MB`.
- `src/assets/characters/sentry/enemy_sentry.glb`: supplied static enemy sentry GLB, about `20.2 MB`.
- `docs/images/shadow-circuit-hero-meshy-model.png`: Meshy model preview.
- `docs/images/shadow-circuit-enemy-sentry-debug.png`: in-game sentry debug preview.

## Runtime

Cinematic quality preloads the character GLBs during the level loading screen. The loader keeps the embedded GLTF animation clips for the hero and starts them through `THREE.AnimationMixer` when hero instances are cloned.

The active sentry asset has no embedded animation clips. Sentry patrol movement, yaw, slow hover bob, and the front-facing spotlight are applied in `Game.ts`, so the supplied static model still reads as an active hovering guard. The spotlight and visible lens marker are placed near the upper front of the body.

Memory first and Balanced still use the original simple procedural player and sentry meshes. If Meshy assets fail to load, the runtime can continue with those fallback shapes.

## Supplied Hero Update

The current hero runtime asset is sourced from the supplied package in extracted form. The runtime loads only:

- `Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb`
- `Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb`

The character loader combines the idle scene with the Run_02 animation clip, blends between `idle` and `run`, and rotates the player group toward movement direction. A floor anchoring fix places the hero's feet on top of the tile surface rather than centering the model into the floor.

The title screen also renders this same cinematic hero GLB in idle state on a black menu scene, so the title does not show level one or use a static character image.

`npm run debug:hero-animation` validates the close-up debug camera, idle-to-run transition, return-to-idle transition, and right-facing yaw when moving right. It writes `artifacts/hero-debug-idle.png`, `artifacts/hero-debug-running-right.png`, and `artifacts/hero-debug-return-idle.png`.

## Supplied Enemy Sentry Update

The current sentry runtime asset is:

- `src/assets/characters/sentry/enemy_sentry.glb`

It is intentionally static. `npm run debug:enemy-sentry` validates the close-up sentry camera, hover range, patrol movement, yaw-to-facing alignment, spotlight-to-facing alignment, and high/front spotlight origin. It writes `artifacts/enemy-debug-sentry-start.png`, `artifacts/enemy-debug-sentry-forward.png`, and `artifacts/enemy-debug-sentry-turn.png`.

## Visual QA

The first visual sub-agent pass accepted the standalone Meshy models but failed the in-game screenshot because the characters were too small and underlit. The runtime was updated to scale Cinematic characters up, boost their GLB materials slightly, and attach a small non-shadow-casting accent light to each cinematic character instance.

The second sub-agent pass returned `PASS` with no blocking issue. The only remaining note is that the hero remains lower contrast than the sentry in very dark areas.

## Follow-Up Risk

These assets are intentionally much larger than the previous fallback GLBs. Browser smoke and local visual screenshots should be rerun after each asset refresh because animation clips and texture size directly affect load time, memory pressure, and top-down readability.
