# Shadow Circuit Level Select

The level select menu is available from the main menu and HUD.

## Behavior

- Shows all five authored levels.
- Uses generated SVG previews derived from each level definition.
- Highlights the currently selected level.
- Starts the selected level immediately when a card is clicked.

The previews intentionally come from level data instead of static screenshots so they stay accurate as blockers, starts, goals, enemies, and lights change.

## Coverage

`npm run test:browser` checks that five level cards render, selects `Signal Vault`, and then starts gameplay from that selection.
