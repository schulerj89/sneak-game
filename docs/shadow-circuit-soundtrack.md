# Shadow Circuit Soundtrack

Shadow Circuit now ships three generated loopable WAV tracks:

- `Shadow Circuit`
- `Pulse Runner`
- `Deep Cover`

The settings menu exposes a soundtrack selector. Runtime playback uses one `HTMLAudioElement` and swaps the source when the selected track changes, which avoids keeping multiple decoded tracks active in memory.

## Regeneration

```powershell
npm run assets:audio
```

This recreates:

- `src/assets/shadow-circuit-theme.wav`
- `src/assets/pulse-runner.wav`
- `src/assets/deep-cover.wav`

## Coverage

`npm run test:browser` switches to `Pulse Runner`, starts the game, and verifies the selected soundtrack log appears.
