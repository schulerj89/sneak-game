# Title Quality Rebuild Scope Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.5.

## Problem

Changing render quality from title settings used the same rebuild path as active gameplay. That path can rebuild objective, blocker, enemy, and goal meshes from `this.level` even when no level scene should be active.

## Why It Matters

Title, goals, and character-select scenes should remain lightweight and predictable. Accidentally adding level objects there increases memory pressure and risks visual clutter before the run starts.

## Patch Scope

- Add `hasActiveLevelScene()` for gameplay-only rebuilds.
- Add `hasTitlePreviewScene()` for title/menu preview refreshes.
- Refresh the title hero preview when quality changes outside gameplay instead of rebuilding level objects.
- Expose `sceneObjectCounts()` through the debug hook so smoke tests can verify the scene boundary.

## Validation

- Desktop smoke changes render quality from the title settings panel.
- Smoke asserts zero objectives, enemies, blockers, and goal meshes while the title preview remains visible.

## Screenshot Evidence

- `docs/2026-06-17-code-review-follow-up-patches/screenshots/02-title-quality-settings.png`
