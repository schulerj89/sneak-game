# Meshy Objective Asset Upgrade

## Decision

Upgrade the cinematic keycard and terminal pickups with new Meshy image-to-3D assets generated from committed reference PNGs, while preserving the existing primitive objective geometry for memory-safe quality.

## Why This Fits Shadow Circuit

- The old objectives were readable but simple; the pickups are core mission objects, so better silhouettes and surface detail improve moment-to-moment reward without changing gameplay rules.
- The assets are reused across every level, so a two-asset upgrade gives broad visual impact without increasing level design complexity.
- Memory-safe mode keeps the lightweight fallback geometry, which protects iPhone/iPad WebKit stability.

## Pipeline

1. Generate source reference plates with `npm run assets:objective-references`.
2. Send each PNG to Meshy Image to 3D using `meshy-6`, PBR texturing, `remove_lighting`, and integrated triangle remesh.
3. Keep final GLBs under the objective asset budget and store non-secret task metadata in `tools/meshy/generated/objectives`.
4. Capture Meshy accepted previews and in-game screenshots for visual QA.

## Accepted Assets

- `src/assets/objectives/keycard-cinematic.glb`
- `src/assets/objectives/terminal-cinematic.glb`
- `src/assets/objectives/reference/ultra-keycard-reference.png`
- `src/assets/objectives/reference/ultra-terminal-reference.png`

## Screenshots

- `previews/keycard-final-front.png`
- `previews/terminal-final-front.png`
- `screenshots/level-1-objectives-desktop.png`
- `screenshots/tutorial-keycard-desktop.png`
- `screenshots/tutorial-terminal-desktop.png`
