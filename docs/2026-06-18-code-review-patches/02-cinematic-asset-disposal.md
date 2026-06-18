# Cinematic Asset Disposal Decision

Date: 2026-06-18
Reviewer: Code Review Expert
Status: Implemented in v2.9.4.

## Problem

The character and objective GLB caches disposed geometries and materials, but Three.js does not automatically dispose textures attached to a material. Releasing cinematic hero, sentry, keycard, or terminal assets could leave texture memory alive longer than intended.

## Why It Matters

The game already relies on cinematic assets on desktop and memory-first fallbacks on constrained devices. Texture disposal is a patch-level reliability fix because it reduces WebGL memory pressure without changing gameplay, level content, or player-facing rules.

## Patch Scope

- Add a shared `disposeObjectResources()` helper for cached Three.js object trees.
- Dispose shared geometries, materials, material texture maps, and shader uniform textures once.
- Route character and objective cache disposal through the helper.
- Release unselected hero roster assets after character select on all quality profiles, including late background loads that finish after the level transition.
- Add focused unit coverage for shared resources and shader uniform textures.

## Validation

- Unit tests cover disposal counts and texture disposal calls.
- Desktop screenshot evidence captures the game after moving from character select into the first level with cinematic assets active.

## Screenshot Evidence

- `docs/2026-06-18-code-review-patches/screenshots/02-cinematic-assets-after-cache-transition.png`
