# Focus Loss Input Clear Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.3.

## Problem

`InputController` tracked `keydown` and `keyup`, but if the browser lost focus while movement was held, the matching `keyup` could be missed.

## Why It Matters

On desktop and mobile browsers, focus changes happen through alt-tab, browser chrome interaction, app switching, and orientation transitions. Movement should never stay stuck after that interruption.

## Patch Scope

- Clear pressed keyboard state and virtual movement on `window.blur`.
- Clear movement when the document becomes hidden.
- Remove the new listeners in `dispose()`.
- Add focused unit tests for both paths.

## Validation

- Unit tests cover blur and visibility-change clearing.
- Browser/mobile smoke verify normal movement and touch controls still work.

## Screenshot Evidence

- `docs/2026-06-17-three-patch-updates/screenshots/03-mobile-touch-after-input-clear.png`
