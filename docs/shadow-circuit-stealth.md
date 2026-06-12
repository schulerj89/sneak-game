# Shadow Circuit Stealth

Stealth detection is intentionally readable:

- Guards have a position, facing vector, range, and field-of-view angle.
- The yellow floor cone shows the active sight area.
- Detection first checks whether the player is inside the cone.
- A line-of-sight ray is then traced from guard to player.
- Obstacles block the ray and prevent detection.
- Player contact with a guard also causes detection.

Runtime detection uses `THREE.Raycaster` against level blocker meshes. Shared TypeScript detection utilities mirror the same rules for unit tests and the walkthrough script.

## Debugging

When debug mode is enabled:

- A green or red debug ray is drawn between each guard and the player.
- The debug panel shows the current detection state.
- Console logs report phase changes, level loads, settings changes, and detection events.
- Collision logs report player contact with guards.
