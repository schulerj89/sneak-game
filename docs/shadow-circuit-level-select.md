# Shadow Circuit Level Select

The level select menu is available from the main menu and HUD.

## Behavior

- Shows all twelve authored levels.
- Uses generated SVG previews derived from each level definition.
- Highlights the currently selected level.
- Starts the selected level immediately when a card is clicked.

The previews intentionally come from level data instead of static screenshots so they stay accurate as blockers, starts, goals, enemies, and lights change.

## Coverage

`npm run test:browser` checks that twelve level cards render, selects `Signal Vault`, confirms music starts from that direct selection, verifies the first-level briefing, and validates the final `Blackout Crown` completion flow.
