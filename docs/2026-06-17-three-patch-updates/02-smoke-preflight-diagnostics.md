# Smoke Preflight Diagnostics Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.2.

## Problem

Desktop smoke defaulted to `127.0.0.1:5173`, which can be a different local app, and its fixed playing-phase timeout could produce vague failures while a level was still loading.

## Why It Matters

False smoke failures waste review time. A smoke test should confirm it is pointed at Shadow Circuit and report the current phase/loading label when a transition is slow.

## Patch Scope

- Add a Shadow Circuit identity preflight using page title, version badge, and debug hook.
- Make desktop playing timeout configurable with `SMOKE_PLAYING_TIMEOUT_MS`.
- Include URL, title, version, phase, level id, loading progress, and overlay text in timeout diagnostics.
- Derive level-select smoke counts from `levels.length` instead of hardcoded level totals.
- Remove the extra level-ready delay after the loading screen has already satisfied its minimum duration so level transitions do not stall on `Ready`.
- Use a looser frame-sample ceiling in headless Chromium, where software rendering is useful for functional smoke but not a reliable 60 FPS signal.

## Validation

- Browser smoke validates the preflight, dynamic level counts, and improved playing waits.
- Build validates the new script types.

## Screenshot Evidence

- `docs/2026-06-17-three-patch-updates/screenshots/02-level-select-desktop.png`
