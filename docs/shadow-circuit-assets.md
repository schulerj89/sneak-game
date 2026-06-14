# Shadow Circuit Assets

The game uses procedural geometry, code-native UI assets, downloaded external music tracks, and small reusable GLB props:

- Player: teal capsule mesh.
- Guards: red cone meshes.
- Vision: transparent cone geometry.
- Cover: box meshes sized per level.
- Goal: emissive green cylinder.
- Logo: inline SVG in `src/game/assets.ts`.
- Objectives: Memory first and Balanced use simple runtime geometry; Cinematic preloads small GLB keycard and terminal props from `src/assets/objectives/`.
- Music: downloaded external MP3 tracks in `src/assets/`.

The logo includes the player character silhouette inside a search cone to keep the brand connected to the game mechanic.

## Meshy Objective Assets

The project-local Meshy MCP config lives in `.codex/config.toml`. It does not commit an API key; launch Codex with `MESHY_API_KEY` set when you want the MCP server to call Meshy. Real asset generation uses:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-objectives
```

The script writes `keycard-cinematic.glb` and `terminal-cinematic.glb` only after confirming each output is under the configured asset-size budget. Use `MESHY_TEST_MODE=true` to exercise API plumbing without overwriting runtime assets.
