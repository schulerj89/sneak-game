# Title Start Re-entry Guard Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.4.

## Problem

`start()` waited on menu music before entering the loading transition. During that async gap, rapid `Start Run` taps could re-enter the start flow.

## Why It Matters

The title screen is the first interaction. It should respond once, switch to loading immediately, and avoid duplicate character-select setup work on desktop clicks or mobile taps.

## Patch Scope

- Remove the pre-transition menu music await from `start()`.
- Let `loadCharacterSelectWithTransition()` become the first awaited action so `isTransitioning()` blocks repeat starts.
- Add desktop and mobile smoke coverage that double-clicks/taps `Start Run` and verifies a single character-select panel.

## Validation

- Desktop smoke checks rapid Start Run clicks before character select.
- Mobile smoke checks the same path in the iPhone-sized flow.

## Screenshot Evidence

- `docs/2026-06-17-code-review-follow-up-patches/screenshots/01-character-select-after-double-start.png`
