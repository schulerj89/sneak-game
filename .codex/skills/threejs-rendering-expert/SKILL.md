---
name: threejs-rendering-expert
description: Review and improve Three.js/WebGL game scenes at an advanced level. Use when Codex is asked to act as a Three.js expert, optimize rendering, object graphs, materials, nodes/TSL readiness, GLB/GLTF scene integration, renderer metrics, draw calls, GPU disposal, animation loops, or minor version upgrades for a Three.js game.
---

# Three.js Rendering Expert

## Review Goal

Improve a Three.js game without destabilizing the current play loop. Prefer changes that make rendering clearer, object ownership safer, or performance more measurable.

## Required Source Grounding

Before making recommendations that depend on Three.js behavior, read `references/official-docs.md`. Use official Three.js docs/manuals as the authority for renderer APIs, Object3D behavior, materials, nodes, instancing, disposal, and matrix/layer semantics.

## Workflow

1. Inspect current git status, package version, smoke scripts, debug hooks, and the main Three.js scene files.
2. Gather renderer budget data already exposed by the game, especially `renderer.info.render` and `renderer.info.memory`.
3. Identify minor-version candidates that satisfy all of these:
   - Improve visible play, scene readability, runtime stability, instrumentation, or performance.
   - Are small enough to ship independently in one minor version bump.
   - Preserve primitive/memory-safe fallbacks when touching cinematic assets.
   - Add automated smoke or unit coverage for the behavior.
   - Avoid risky new dependencies or large shader/material rewrites unless the game already has the foundation.
4. For each candidate, document:
   - Official Three.js principle used.
   - Player or maintainer benefit.
   - Files likely touched.
   - Validation plan and budget expectation.
   - Expected minor version bump.
5. If implementing, keep each minor bump separately commit-ready with changelog, docs, tests/smoke, and screenshots only when the change is visible.

## Recommendation Priorities

- First: scene graph ownership, object lifecycle, resource disposal, and reset/loading leaks.
- Second: draw-call reduction through reuse, instancing, shared materials, or lower-cost overlay rendering.
- Third: player-facing readability from lighting, layers, render order, camera framing, and material choices.
- Fourth: future-facing node/material readiness only when it can be documented or isolated without runtime risk.

## Guardrails

- Do not propose WebGPU/TSL migration as a quick win unless the implementation is isolated and reversible.
- Do not replace authored gameplay geometry with imported meshes for collision.
- Do not add large assets when a renderer/object-graph improvement would solve the problem.
- Do not rely on headless FPS alone for performance claims; use it for functional smoke and pair with visible browser/debug data when possible.
- Do not mutate shared geometries or materials per instance unless that sharing contract is explicit.
