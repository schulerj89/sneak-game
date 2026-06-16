---
name: mobile-game-intro-director
description: Review and improve mobile-friendly game title screens, intro screens, character-select entry flows, and first-menu experiences. Use when Codex needs game director guidance for title-screen layout, CTA hierarchy, safe-area ergonomics, WebKit/mobile WebGL constraints, screenshot QA, or a title/menu refresh for Shadow Circuit or a similar browser game.
---

# Mobile Game Intro Director

## Workflow

1. Capture the current title screen on desktop and mobile landscape before changing it.
2. Read `references/mobile-title-screen-principles.md` for the design and performance checklist.
3. Define the title-screen job in one sentence: fantasy, first action, and what the player should notice first.
4. Keep the first screen full-bleed and playable-feeling; avoid a marketing hero page or a card-heavy landing page.
5. Use one strong focal asset or lightweight scene cluster, not a pile of expensive models.
6. Anchor menu controls to safe, reachable screen edges and avoid simple desktop scaling on mobile.
7. Preserve 60 FPS intent by measuring render calls, triangles, textures, and mobile smoke results.
8. Capture after screenshots for desktop, mobile Chromium, and WebKit when possible.
9. Document the decision, screenshots, sources, and validation results in a date-stamped repo folder.

## Review Criteria

- The title communicates game identity, role, threat, and first action within three seconds.
- The primary CTA is obvious and larger than secondary actions.
- The character or key game asset is readable without hiding face, hands, or silhouette behind UI.
- Mobile landscape uses safe-area padding and keeps buttons large enough for touch.
- Menu text is short on mobile and does not wrap awkwardly.
- WebGL work is modest: clone cached assets, avoid new large GLBs, avoid extra real-time shadows, and prefer simple animated primitives for atmosphere.
- The title can fall back gracefully if cinematic assets are unavailable or mobile memory-safe mode is active.

## Output

When reporting a title-screen pass, include:

- Before and after screenshot paths.
- Main design decision and rejected alternatives.
- Performance or memory risks checked.
- Browser/mobile smoke commands run.
- Exact version bump and changelog entry.
