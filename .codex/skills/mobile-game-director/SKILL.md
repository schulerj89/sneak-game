---
name: mobile-game-director
description: Review and improve mobile-first browser game experiences, including touch ergonomics, goals, badges, settings, onboarding, session incentives, title and character-select flows, and WebKit/WebGL performance constraints. Use when Codex needs game direction for Shadow Circuit or a similar mobile-friendly browser game.
---

# Mobile Game Director

## Workflow

1. Capture the current target screen or flow on desktop and mobile landscape before changing it.
2. Read `references/mobile-game-principles.md` for the mobile game design and performance checklist.
3. Define the player job in one sentence: what the player should do, why it matters now, and what feedback confirms progress.
4. Choose the smallest feature that improves the loop without adding avoidable asset, memory, or WebKit risk.
5. Keep mobile controls reachable, labels short, and panels compact enough for iPhone landscape safe areas.
6. Prefer incentives that reuse existing progress data: goals, badges, streaks, daily contracts, mastery marks, or lightweight rewards.
7. Preserve 60 FPS intent by checking render calls, triangles, textures, mobile smoke tests, and WebKit-sensitive paths when relevant.
8. Capture after screenshots for the same desktop and mobile states used in the before pass.
9. Document the decision, rejected alternatives, screenshot paths, and validation results in a date-stamped repo folder.

## Review Criteria

- The update makes the next play action clearer or more rewarding within three seconds.
- Mobile landscape avoids hidden buttons, cramped panels, long descriptions, and unsafe gesture-edge targets.
- Goals, badges, or settings copy stays short on mobile while still communicating progress.
- The feature works with memory-safe assets and does not depend on title-only or level-only heavy loads.
- Browser state is resilient: storage failures, missing progress, and unsupported APIs fail softly.
- Visual feedback is readable without covering the player, objective list, joystick, or mission controls.
- The implementation keeps responsibilities local: progress math outside UI rendering, UI rendering outside game-state mutation.

## Output

When reporting a mobile game direction pass, include:

- Before and after screenshot paths.
- Main decision and why it fits mobile play.
- Rejected alternatives and why they were riskier or less useful.
- Performance, memory, or WebKit risks checked.
- Browser/mobile smoke commands run.
- Exact version bump and changelog entry.
