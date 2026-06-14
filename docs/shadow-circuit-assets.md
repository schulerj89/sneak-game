# Shadow Circuit Assets

The game uses procedural geometry, code-native UI assets, downloaded external music tracks, and small reusable GLB props:

- Player: Memory first and Balanced use the teal capsule mesh; Cinematic preloads a small reusable hero GLB.
- Guards: Memory first and Balanced use red cone meshes; Cinematic preloads a small reusable sentry GLB.
- Vision: transparent cone geometry.
- Cover: box meshes sized per level.
- Goal: emissive green cylinder.
- Logo: inline SVG in `src/game/assets.ts`.
- Objectives: Memory first and Balanced use simple runtime geometry; Cinematic preloads small GLB keycard and terminal props from `src/assets/objectives/`.
- Characters: Cinematic preloads `hero-cinematic.glb` and `sentry-cinematic.glb` from `src/assets/characters/`.
- Music: downloaded external MP3 tracks in `src/assets/`.

The logo includes the player character silhouette inside a search cone to keep the brand connected to the game mechanic.

## Meshy Objective Assets

The project-local Meshy MCP config lives in `.codex/config.toml`. It does not commit an API key; launch Codex with `MESHY_API_KEY` set when you want the MCP server to call Meshy. Real asset generation uses:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-objectives
```

The script writes `keycard-cinematic.glb` and `terminal-cinematic.glb` only after confirming each output is under the configured asset-size budget. Use `MESHY_TEST_MODE=true` to exercise API plumbing without overwriting runtime assets.

## Meshy Character Assets

The character pipeline is prepared for Meshy Text to 3D, rigging, and animation:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-characters
```

Without a Meshy key, the fallback path writes lightweight local GLBs that match the intended hero and sentry silhouettes:

```powershell
$env:MESHY_CHARACTER_FALLBACK = "true"
npm run assets:meshy-characters
```

The runtime still falls back to the original procedural meshes outside Cinematic quality, so Memory first remains the safest path on constrained devices.
