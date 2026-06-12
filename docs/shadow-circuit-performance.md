# Shadow Circuit Performance

The project targets crisp rendering while staying under a `75 MB` browser heap budget when browser memory reporting is available. Settings persist in local storage and start in `Balanced` mode.

## Quality Profiles

- `Memory first`: pixel ratio is capped at `1`, antialiasing is disabled, shadows are disabled.
- `Balanced`: pixel ratio is capped at `1.35`, antialiasing and shadows are enabled.
- `Cinematic`: pixel ratio is capped at `1.9`, antialiasing and shadows are enabled with larger shadow maps and a `42 MB` quality reserve.

## Monitoring

The debug panel displays:

- FPS and frame time.
- Browser JS heap usage when `performance.memory` is available.
- Memory cap and pressure state.
- Three.js draw calls and triangle count.
- Active render quality.
- Reserved cinematic memory.

Run this during checkpoints:

```powershell
npm run verify
npm run test:browser
```

The browser panel remains the primary in-game memory signal because the renderer runs in the browser process.
