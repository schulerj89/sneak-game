# Shadow Circuit Levels

Each level now includes two required objective markers before the exit unlocks. Yellow keycards and blue terminals are placed on the validated route, shown as HUD objective chips, and confirmed with a short collection notice when picked up.

Levels live in `src/game/levels.ts` and are plain strict TypeScript data. The current build ships five levels.

Each level defines:

- Room size.
- Player start.
- Goal location and radius.
- Rectangular blockers.
- Colored lights.
- Guard specs.
- Required keycard and terminal objectives.
- A validation route for automated smoke checks.

## Validation Script

```powershell
npm run test:levels
```

The script samples each validation route and checks:

- Route points stay inside the room.
- Route points do not intersect cover.
- Route points are not immediately inside dangerous close-range guard sight.
- Required objectives are collected before the exit route finishes.

These routes are not full AI solutions. They are maintenance rails that catch broken level geometry or impossible starts.

## Current Levels

- `Dock Blackout`
- `Archive Lanes`
- `Reactor Core`
- `Neon Atrium`
- `Signal Vault`
