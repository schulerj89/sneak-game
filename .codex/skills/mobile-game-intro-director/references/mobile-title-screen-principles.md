# Mobile Title Screen Principles

## Research Notes

- Apple handheld game guidance emphasizes flexible layouts, full-screen use, legibility, touch controls, and safe areas rather than simply scaling a desktop interface down.
- Apple safe-area guidance matters for iPhone landscape because rounded corners, gesture regions, and the home indicator can obscure UI.
- WebGL CPU dispatch has overhead; keep title scenes low in draw calls and reuse loaded assets.
- Canvas/WebGL animation should use `requestAnimationFrame`, track elapsed time, and avoid unnecessary redraw or resource churn.

## Practical Checklist

1. Use a full-bleed scene as the first read, with UI over it rather than inside a large floating card.
2. Keep one primary action in the strongest visual position. Secondary actions should be smaller and grouped.
3. On mobile landscape, anchor controls to reachable lower or side regions with safe-area padding.
4. Use short action labels: Start, Levels, Goals, Settings.
5. Keep the hero face and silhouette clear. Move UI away from the face, not the model away from the center.
6. Prefer lightweight ambience: simple patrol lines, scan cones, small particles, or shaderless geometry.
7. Avoid loading additional title-only GLBs; reuse cached hero/sentry/objective assets or primitives.
8. Verify mobile WebKit separately because iOS browser memory and WebGL behavior can differ from desktop Chromium.

## Sources

- Apple, "Design great interfaces for handheld games": https://developer.apple.com/videos/play/meet-with-apple/243/
- Apple, "Designing for games": https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- Apple, "Launching": https://developer.apple.com/design/human-interface-guidelines/launching
- Apple, "Game controls": https://developer.apple.com/design/human-interface-guidelines/game-controls
- Unity, "Web performance considerations": https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-performance.html
- web.dev, "Improving HTML5 Canvas performance": https://web.dev/articles/canvas-performance
