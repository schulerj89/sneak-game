# Shadow Circuit

Shadow Circuit is a local Three.js stealth game prototype. You sneak through dark rooms, avoid patrolling guards and their visible sight cones, use cover to block line-of-sight rays, and reach the exit pad to advance through the first three levels.

## Current Features

- Three playable levels: Dock Blackout, Archive Lanes, and Reactor Core.
- Menu, settings, retry, and level-complete flows.
- Guard patrols with visible cones and raycast line-of-sight detection.
- Dark-room lighting, emissive goals, shadows by quality setting, and simple custom assets.
- Custom generated theme music in `src/assets/shadow-circuit-theme.wav`.
- Memory-first default rendering with Balanced and Cinematic options.
- On-screen debug panel with FPS, memory, draw calls, player position, and detection state.
- Console logs for game phase, level loads, settings, audio, and detection events.
- Unit tests, level route validation, and browser smoke coverage.

## Controls

- Move: `WASD` or arrow keys.
- Toggle menu: `Esc`.
- Toggle debug tools: `F1`.

## Run Locally

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Scripts

```powershell
npm run dev          # Start local Vite dev server
npm run build        # Type-check and build production assets
npm run test:run     # Run Vitest unit tests
npm run test:levels  # Validate authored level routes
npm run test:browser # Run Playwright smoke test against the local dev server
npm run verify       # Run unit tests, level validation, and production build
npm run assets:audio # Regenerate the custom WAV theme
```

`npm run test:browser` expects the dev server to be running at `http://127.0.0.1:5173/`.

## Project Structure

```text
src/game/                 Core game systems
src/assets/               Generated runtime assets
scripts/                  Validation, browser smoke, and asset generation scripts
docs/shadow-circuit-*.md  Focused design and system notes
```

## Checkpoint Workflow

Before pushing gameplay changes:

```powershell
npm run verify
npm run test:browser
Get-Process node | Select-Object Id,ProcessName,CPU,WorkingSet,StartTime
```

Then commit and push the checkpoint.

## Documentation

- `docs/shadow-circuit-overview.md`
- `docs/shadow-circuit-stealth.md`
- `docs/shadow-circuit-performance.md`
- `docs/shadow-circuit-levels.md`
- `docs/shadow-circuit-assets.md`
