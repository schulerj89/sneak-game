# Versioned Tutorial Pin Decision

Date: 2026-06-18
Reviewer: Code Review Expert
Status: Implemented in v2.9.3.

## Problem

The first-run cinematic tutorial used the current package version as its introduced version. Every patch bump changed the stored `seen` value it expected, so a player who already watched the v2.8.0 tutorial could see it again after a later patch.

## Why It Matters

Patch releases should not reset onboarding for returning players. The versioned feature system should only replay a feature when the feature itself is reintroduced under a new explicit version.

## Patch Scope

- Pin the first-run cinematic tutorial introduced version to `2.8.0`, the version where it shipped.
- Keep the existing storage key and record shape unchanged.
- Add a regression test that a stored `2.8.0` flag suppresses the tutorial under a later app version.

## Validation

- Unit tests cover the versioned feature behavior.
- Desktop screenshot evidence captures a profile with the stored tutorial flag proceeding past hero select without entering the tutorial.

## Screenshot Evidence

- `docs/2026-06-18-code-review-patches/screenshots/01-tutorial-seen-starts-loading.png`
