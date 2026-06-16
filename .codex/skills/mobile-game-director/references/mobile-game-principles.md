# Mobile Game Principles

## Research Notes

- Apple handheld game guidance emphasizes flexible full-screen layouts, legibility, safe areas, and controls designed for thumbs rather than scaled desktop UI.
- Short-session mobile games benefit from visible goals, quick rewards, and progress surfaces that tell players what to do next without forcing a long menu read.
- WebGL CPU dispatch and GPU memory can be the limiting factor on mobile browsers; reuse cached assets, avoid unnecessary real-time shadows, and keep overlay work modest.
- Canvas/WebGL animation should use `requestAnimationFrame`, track elapsed time, and avoid resource churn when switching screens or levels.

## Practical Checklist

1. Keep the next useful action visible: start, continue, retry, goal, or setting.
2. On mobile landscape, place high-frequency controls in reachable lower or side regions with safe-area padding.
3. Prefer short mobile labels: Start, Goals, Badges, Retry, Mute, Level, Back.
4. Use progress bars, badge states, or clear daily/weekly tasks to create a reason to replay without adding heavy systems.
5. Show only the detail needed on mobile; move long descriptions to desktop or secondary states.
6. Reuse existing level, achievement, best-time, and grade data before creating new save formats.
7. Handle missing or blocked storage by rendering a useful default state and continuing play.
8. Verify mobile WebKit separately when a feature touches assets, loading, storage, audio, or WebGL context lifecycle.

## Sources

- Apple, "Design great interfaces for handheld games": https://developer.apple.com/videos/play/meet-with-apple/243/
- Apple, "Designing for games": https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- Apple, "Game controls": https://developer.apple.com/design/human-interface-guidelines/game-controls
- Apple, "Layout": https://developer.apple.com/design/human-interface-guidelines/layout
- Unity, "Web performance considerations": https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-performance.html
- web.dev, "Improving HTML5 Canvas performance": https://web.dev/articles/canvas-performance
