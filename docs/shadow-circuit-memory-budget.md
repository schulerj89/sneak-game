# Shadow Circuit Memory Budget

The current target is:

- Memory cap: `75 MB`
- Frame target: `60 FPS`
- Default quality: `Balanced`

Balanced mode uses more memory than the original memory-first default by enabling antialiasing and shadows with a capped pixel ratio. The cap remains conservative so gameplay stays crisp without growing unchecked.

## Runtime Guard

When `performance.memory` is available, the game checks JS heap usage each frame. If reported heap usage exceeds `75 MB`, the renderer automatically downgrades to `Memory first` quality and logs a warning.

## Debug Panel

The debug panel now shows:

- FPS and frame time.
- Target FPS.
- Current memory and cap.
- Memory pressure state.
- Draw calls and triangles.
- Render quality.
- Selected soundtrack.

## Checkpoint Command

```powershell
Get-Process node | Select-Object Id,ProcessName,CPU,WorkingSet,StartTime
```
