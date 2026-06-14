# Shadow Circuit Memory Budget

The current target is:

- Advisory memory cap: `192 MB`
- Frame target: `60 FPS`
- Default quality: `Balanced`
- Highest quality: `Cinematic`

Balanced mode uses more memory than the original memory-first default by enabling antialiasing and shadows with a capped pixel ratio. Cinematic mode uses more memory again through higher pixel ratio, larger shadow maps, a `64 MB` typed-array quality reserve, and small preloaded GLB objective props. The cap is advisory so player-selected graphics quality is not silently overwritten.

## Runtime Guard

When `performance.memory` is available, the game checks JS heap usage each frame. If reported heap usage exceeds `192 MB`, the debug panel reports `over-cap` and the game logs a warning once while keeping the selected render quality.

## Debug Panel

The debug panel now shows:

- FPS and frame time.
- Target FPS.
- Current memory and cap.
- Memory pressure state.
- Draw calls and triangles.
- Render quality.
- Selected soundtrack.
- Reserved memory for high-quality mode.

## Checkpoint Commands

```powershell
npm run verify
npm run test:browser
```
