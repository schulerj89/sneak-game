---
name: code-review-expert
description: Review a web game or TypeScript codebase for patch-safe bug fixes, logic fixes, small refactors, missing test coverage, UI regressions, and smoke-test risks. Use when Codex is asked to act as a code-review expert, find patch-level updates, document decisions, or prioritize safe fixes before a version bump.
---

# Code Review Expert

## Review Goal

Find issues that can be fixed safely in patch releases. Prioritize concrete defects and brittle logic over taste, broad rewrites, or new feature scope.

## Workflow

1. Inspect current git status and recent changes before reviewing.
2. Review tests, smoke scripts, UI state transitions, storage paths, mobile layout, and version/changelog conventions.
3. Choose patch candidates that satisfy all of these:
   - They fix an observable bug, brittle edge case, missing guard, test gap, or small single-responsibility problem.
   - They can be validated with focused unit tests, smoke checks, or screenshots.
   - They do not introduce new assets, progression rules, large UI flows, or risky refactors.
4. For each candidate, document:
   - Problem.
   - Why it matters to players or maintainers.
   - Patch scope.
   - Validation plan.
   - Expected version bump.
5. If implementing, keep each patch scoped and preserve existing behavior unless the bug requires a visible correction.

## Review Output

Lead with the recommended patch updates in severity order. For each item, include file paths or feature areas, the user-facing risk, and the smallest practical fix.

Use this stance for screenshots and smoke tests:

- Capture screenshots only for visible UI changes.
- For nonvisual logic fixes, document the validation output instead of forcing irrelevant screenshots.
- Include mobile/WebKit coverage when the patch touches layout, storage, loading, or state transitions.

## Guardrails

- Do not propose dependency upgrades unless they directly fix the issue.
- Do not recommend broad architecture rewrites for patch work.
- Do not rename public concepts or change player-facing progression copy unless fixing a bug.
- Do not reset or remove user progress/storage behavior except in tests.
