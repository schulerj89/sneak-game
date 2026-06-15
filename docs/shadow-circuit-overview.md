# Shadow Circuit Overview

Shadow Circuit is a local Three.js stealth game prototype. The first iteration focuses on simple readable geometry, clear guard vision cones, dark-room lighting, and a complete game loop with menu, settings, music, debugging, tests, and level validation scripts.

## Current Loop

1. Start from the menu.
2. Move with `WASD` or arrow keys.
3. Avoid red guard patrols and their yellow sight cones.
4. Use crates, shelves, pillars, and consoles to block sight rays.
5. Reach the green exit pad to advance to the next level.

## Level Set

- `Dock Blackout`: cargo cover and a single rectangular patrol.
- `Archive Lanes`: long aisles with two sweeping guards.
- `Reactor Core`: two patrols around a brighter central hazard.
- Later levels add multi-objective routing, tighter patrol timing, and the final `Blackout Crown` challenge.

## Checkpoints

Every meaningful implementation checkpoint should run:

```powershell
npm run verify
```

Browser validation should confirm the menu renders, the game starts, debug data updates, settings change quality/music/debug state, and all twelve levels can be reached.
