# Shadow Circuit

Shadow Circuit is a local Three.js stealth game prototype. You sneak through dark rooms, avoid patrolling guards and their visible sight cones, use cover to block line-of-sight rays, and reach the exit pad across twelve levels.

## Current Features

- Twelve playable levels from Dock Blackout through Blackout Crown, with easy, medium, hard, and final challenge layouts.
- Menu, settings, retry, and level-complete flows.
- GitHub Pages deployment workflow for publishing the built Vite app from `dist`.
- Black title screen with text-only branding and the cinematic hero GLB idling beside it.
- Character select flow after Start Run, with four preloaded heroes and reusable hero definitions for new operatives.
- First-level mission briefing that explains keycards, terminals, sentries, vision cones, and the locked exit.
- Level select menu with generated level preview images.
- Guard patrols with visible cones and raycast line-of-sight detection.
- Suspicion meter with alert recovery and detection leniency settings.
- Guard collision: touching a guard now triggers detection.
- Objective-gated exits across all levels with keycards, terminals, color-swatch HUD chips, collection notices, pickup chimes, and cinematic 3D objective props.
- Cinematic hero idle/run GLBs plus a supplied enemy sentry GLB with code-driven hover, front spotlight, and procedural mesh fallback for lower quality modes.
- Dark-room lighting, dim locked exits, unlock-only goal beacons, shadows by quality setting, and simple custom assets.
- Shader-based floor detail, goal beacons, and contact shadows.
- Downloaded external soundtrack choices with title-screen music, per-level track assignment, and auditable license metadata.
- Level loading simulates the full collectible pickup sequence so objective UI, mesh visibility, unlock states, and pickup audio are warmed before play starts.
- Cinematic default rendering with a 320 MB advisory browser heap cap.
- On-screen debug panel with FPS, memory, draw calls, player position, detection state, active track, and pickup timing/audio diagnostics.
- Console logs for game phase, level loads, settings, audio, and detection events.
- Mobile touch joystick for phone/tablet play.
- Unit tests, level route validation, browser smoke coverage, and mobile smoke coverage.

## Controls

- Move: `WASD` or arrow keys.
- Mobile move: drag the translucent on-screen joystick.
- Mobile layout: rotate to landscape when prompted.
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
npm run test:mobile  # Run mobile viewport joystick smoke test against the local dev server
npm run debug:hero-animation # Capture close-up hero idle/run/yaw debug screenshots
npm run debug:enemy-sentry # Capture close-up sentry hover/light debug screenshots
npm run assets:meshy-objectives # Generate Meshy objective GLBs when MESHY_API_KEY is set
npm run assets:meshy-characters # Generate Meshy or fallback character GLBs
npm run screenshots   # Capture README screenshots into docs/images
npm run verify       # Run unit tests, level validation, and production build
```

`npm run test:browser` expects the dev server to be running at `http://127.0.0.1:5173/`. It runs headed by default for realistic frame pacing; set `SMOKE_HEADLESS=true` if a headless smoke pass is needed.

`npm run test:mobile` uses a mobile/touch browser context against the same dev server and writes `artifacts/shadow-circuit-mobile-touch.png`.

## GitHub Pages

The Pages workflow lives at `.github/workflows/main.yml`. It runs on pushes to `main` and from the Actions tab, installs dependencies, runs the unit and level route checks, builds with the GitHub Pages base path, uploads `dist`, and deploys the artifact.

Expected Pages URL:

```text
https://schulerj89.github.io/sneak-game/
```

If the first run does not deploy, open the repository on GitHub and set Settings -> Pages -> Build and deployment -> Source to GitHub Actions.

## Project Structure

```text
src/game/                 Core game systems
src/assets/               Downloaded and generated runtime assets
scripts/                  Validation, browser smoke, Meshy asset, and screenshot scripts
docs/shadow-circuit-*.md  Focused design and system notes
```

## Checkpoint Workflow

Before pushing gameplay changes:

```powershell
npm run verify
npm run test:browser
```

Then commit and push the checkpoint.

## Screenshots

### Menus

![Level Select](docs/images/shadow-circuit-level-select.png)

![Settings](docs/images/shadow-circuit-settings.png)

### Levels

![Dock Blackout](docs/images/shadow-circuit-level-1-dock-blackout.png)

![Archive Lanes](docs/images/shadow-circuit-level-2-archive-lanes.png)

![Reactor Core](docs/images/shadow-circuit-level-3-reactor-core.png)

![Neon Atrium](docs/images/shadow-circuit-level-4-neon-atrium.png)

![Signal Vault](docs/images/shadow-circuit-level-5-signal-vault.png)

![Transit Switchyard](docs/images/shadow-circuit-level-6-transit-switchyard.png)

![Mirror Lab](docs/images/shadow-circuit-level-7-mirror-lab.png)

![Command Spire](docs/images/shadow-circuit-level-8-command-spire.png)

![Service Gallery](docs/images/shadow-circuit-level-9-service-gallery.png)

![Cooling Ducts](docs/images/shadow-circuit-level-10-cooling-ducts.png)

![Datacore Maze](docs/images/shadow-circuit-level-11-datacore-maze.png)

![Blackout Crown](docs/images/shadow-circuit-level-12-blackout-crown.png)

## Documentation

- `docs/shadow-circuit-overview.md`
- `docs/shadow-circuit-stealth.md`
- `docs/shadow-circuit-performance.md`
- `docs/shadow-circuit-levels.md`
- `docs/shadow-circuit-assets.md`
- `docs/shadow-circuit-level-select.md`
- `docs/shadow-circuit-soundtrack.md`
- `docs/shadow-circuit-meshy.md`
- `docs/shadow-circuit-06-14-2026-levels-characters-decision.md`
- `docs/shadow-circuit-06-14-2026-character-asset-refresh.md`
- `docs/shadow-circuit-memory-budget.md`
- `docs/shadow-circuit-shaders.md`
- `docs/shadow-circuit-06-12-2026-improve-decision.md`
