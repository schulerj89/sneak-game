# Settings Storage Sanitize Decision

Date: 2026-06-17
Reviewer: Code Review Expert
Status: Implemented in v2.4.6.

## Problem

`loadSettings()` accepted stored values with the right keys but wrong runtime types, including non-boolean music/debug flags and invalid volume numbers.

## Why It Matters

Browser storage can be edited, migrated, blocked, or corrupted. Settings should degrade to known defaults instead of letting malformed values alter UI, audio, or debug behavior.

## Patch Scope

- Parse stored settings as `unknown`.
- Require an object before reading saved keys.
- Accept only boolean values for `musicEnabled` and `debugEnabled`.
- Accept only finite numeric volume values before clamping.
- Add focused tests for primitive stored settings, corrupted settings fields, and blocked writes.

## Validation

- Unit tests cover malformed saved settings and localStorage write failures.
- Browser smoke still validates the visible Settings panel and version badge.

## Screenshot Evidence

- `docs/2026-06-17-code-review-follow-up-patches/screenshots/03-settings-panel-after-sanitize.png`
