# Shadow Circuit Title Screen Refresh

Date: 2026-06-16
Version: v1.0.0

## Goal

Make the first screen feel like a polished mobile-friendly stealth game intro while preserving fast startup, WebKit compatibility, and the 60 FPS target.

## Research Inputs

- Apple handheld game interface guidance: use flexible layouts, safe areas, legible text, and touch-friendly controls instead of scaling desktop UI directly.
  https://developer.apple.com/videos/play/meet-with-apple/243/
- Apple game design guidance: design for the device and its input model.
  https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- WebKit iPhone safe-area guidance: landscape UI must account for `env(safe-area-inset-*)`.
  https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- Unity WebGL performance guidance: keep WebGL draw calls low because CPU-side WebGL dispatch is relatively expensive.
  https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-performance.html
- web.dev canvas performance guidance: use `requestAnimationFrame` and avoid unnecessary per-frame work.
  https://web.dev/articles/canvas-performance

## Decision

- Replace the sparse title layout with a mission-command composition: title and controls are anchored in the lower-left safe area, while the hero and tactical scene remain visible.
- Make `Start Run` the only dominant CTA and keep `Levels`, `Goals`, and `Settings` smaller secondary actions.
- Reuse the existing hero preview and add only cheap Three.js primitives: floor grid, route line, objective nodes, security bars, and a sentry sweep.
- Avoid new title-only GLBs, video, postprocessing, or shadow-heavy effects.
- Keep character-select behavior unchanged except for sharing the lightweight title stage behind the existing picker.
- Add a repo-local `mobile-game-intro-director` skill so future agents can review title/menu work against mobile, WebKit, screenshot, and asset-budget constraints.

## Screenshots

Before:

- `screenshots/before-desktop.png`
- `screenshots/before-mobile-landscape.png`

After:

- `screenshots/after-desktop.png`
- `screenshots/after-mobile-landscape.png`
- `screenshots/after-webkit-mobile-landscape.png`

## Performance Notes

- Title render budget from `title-screen-metrics.json`: 14 draw calls, 96,271 triangles, 11 geometries, 2 renderer textures.
- Headed Chromium mobile sample in `title-screen-headed-fps.json`: roughly 60 FPS with about 16.6-16.8 ms frames.
- No additional downloaded assets were added for the title refresh.
- Headless WebKit and Chromium both reached the refreshed title screen and produced screenshots.

## Validation

- `npm run build`
- `npm run test:run`
- `npm run test:browser`
- `npm run test:mobile`
- `MOBILE_SMOKE_BROWSER=webkit npm run test:mobile`
