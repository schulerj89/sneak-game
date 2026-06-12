# Shadow Circuit Performance

The project prioritizes memory by default. Settings persist in local storage and start in `Memory first` mode.

## Quality Profiles

- `Memory first`: pixel ratio is capped at `1`, antialiasing is disabled, shadows are disabled.
- `Balanced`: pixel ratio is capped at `1.5`, antialiasing and shadows are enabled.
- `Cinematic`: pixel ratio is capped at `2`, antialiasing and shadows are enabled.

## Monitoring

The debug panel displays:

- FPS and frame time.
- Browser JS heap usage when `performance.memory` is available.
- Three.js draw calls and triangle count.
- Active render quality.

Run this during checkpoints:

```powershell
Get-Process node | Select-Object Id,ProcessName,CPU,WorkingSet
```

The browser panel remains the primary in-game memory signal because the renderer runs in the browser process.
