# Browser Smoke Screenshot Paths Decision

Date: 2026-06-18
Reviewer: Code Review Expert
Status: Implemented in v2.9.5.

## Problem

The desktop browser smoke script hardcoded release screenshots to `docs/2026-06-18-versioned-tutorial-settings/screenshots`. Any future smoke run could rewrite old release evidence and make unrelated documentation appear modified.

## Why It Matters

Smoke tests should be safe to run during any patch. Their default artifacts should describe the current validation run instead of mutating historical decision folders.

## Patch Scope

- Add `SMOKE_SCREENSHOT_DIR` for general browser smoke screenshots.
- Add `SMOKE_RELEASE_SCREENSHOT_DIR` for tutorial, iPad, and settings evidence captures.
- Default release smoke evidence to `artifacts/browser-smoke/v<version>` when no explicit release directory is provided.
- Wait through the configured playable-loading timeout before asserting the first-run tutorial panel, since heavy cinematic asset warmups can legitimately exceed the generic 8-second visibility helper.
- Wait for tutorial captions to have a real layout box before capturing screenshots, preventing headless timing races where text exists before CSS layout is ready.
- Stabilize debug tutorial shot capture by extending the active tutorial auto-advance timer while smoke screenshots are being taken.
- Retry debug level selection once after a Vite navigation interruption, then re-check app identity before continuing.
- Keep existing screenshot filenames and smoke assertions unchanged.

## Validation

- Headed desktop browser smoke passed with custom `SMOKE_SCREENSHOT_DIR` and `SMOKE_RELEASE_SCREENSHOT_DIR` artifact folders.
- Selected smoke evidence was copied from the passed artifact run into this decision folder after the browser session completed.
- The old `docs/2026-06-18-versioned-tutorial-settings/screenshots` path is no longer the smoke default.

## Screenshot Evidence

- `docs/2026-06-18-code-review-patches/screenshots/03-browser-smoke-release/01-tutorial-hero-closeup-desktop.png`
- `docs/2026-06-18-code-review-patches/screenshots/03-browser-smoke-release/settings-clear-data-desktop.png`
