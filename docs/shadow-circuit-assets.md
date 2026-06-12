# Shadow Circuit Assets

The first iteration uses procedural and code-native assets so the repo is self-contained:

- Player: teal capsule mesh.
- Guards: red cone meshes.
- Vision: transparent cone geometry.
- Cover: box meshes sized per level.
- Goal: emissive green cylinder.
- Logo: inline SVG in `src/game/assets.ts`.
- Music: generated custom WAV soundtrack files in `src/assets/`.

The logo includes the player character silhouette inside a search cone to keep the brand connected to the game mechanic.

Regenerate the soundtrack with:

```powershell
npm run assets:audio
```
