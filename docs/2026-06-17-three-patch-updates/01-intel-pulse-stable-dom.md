# Intel Pulse Stable DOM Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.1.

## Problem

Mobile smoke can reach `playing` and then miss the `Mission Intel Pulse` tap because the dock markup is repeatedly replaced. `renderIntelPulse()` rebuilt `innerHTML`, detaching the button node during HUD refreshes.

## Why It Matters

Replacing an interactive mobile button while the player is trying to tap it can lose taps, focus, and Playwright handles. The feature should update state without recreating the control every second.

## Patch Scope

- Mount the Intel Pulse button/copy once while playing.
- Update disabled state, charge count, status text, meter width, and active/mobile classes in place.
- Keep existing non-playing cleanup behavior.

## Validation

- Mobile smoke verifies Intel Pulse remains tappable.
- Screenshot evidence captures mobile landscape after triggering Intel Pulse.

## Screenshot Evidence

- `docs/2026-06-17-three-patch-updates/screenshots/01-intel-pulse-mobile-landscape.png`
