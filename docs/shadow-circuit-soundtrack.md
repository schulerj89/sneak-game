# Shadow Circuit Soundtrack

Shadow Circuit now ships one external default track and five generated fallback tracks:

- `Ghost Steps`
- `Night Ops`
- `Shadow Circuit`
- `Pulse Runner`
- `Deep Cover`
- `Metro Escape`

The settings menu exposes a soundtrack selector. Runtime playback uses one `HTMLAudioElement` and swaps the source when the selected track changes, which avoids keeping multiple decoded tracks active in memory.

`Ghost Steps` is the new default mix. It is an external CC-BY 4.0 track from OpenGameArt with cyberpunk, stealth, ambient, and loop tags. `Night Ops` remains a generated fallback with a steadier tempo, lighter hats, and a slow pad layer. `Metro Escape` remains the higher-tempo generated replacement-track candidate. The game imports runtime music as MP3 where possible so the payload stays smaller than additional full WAV loops.

## License Manifest

Generated tracks are created by `scripts/generate-audio.ts` and are project-owned generated audio. External tracks must keep their original source, license, and attribution in `src/game/audio.ts`.

Current external attribution:

- `"Ghost Steps" from "Code Injection Dark Techno Music Pack" by DavidKBD. License: CC BY 4.0. Includes tracks by Tsorthan Grove: "Morbid technology" and "Dark Ambient Drone #2", CC-BY 4.0. Source: https://opengameart.org/content/ghost-steps-davidkbd-vs-tsorthan-grove`

When external royalty-free tracks are added, each track must include:

- Track title.
- Author or source account.
- Original source URL.
- License name and license URL when available.
- Required attribution text, or a note that attribution is not required.
- Any Content ID or redistribution caveats.

## Regeneration

```powershell
npm run assets:audio
```

This recreates:

- `src/assets/ghost-steps.mp3` from the OpenGameArt OGG source when manually refreshed
- `src/assets/shadow-circuit-theme.wav`
- `src/assets/pulse-runner.wav`
- `src/assets/deep-cover.wav`
- `src/assets/night-ops.wav`
- `src/assets/night-ops.mp3` when `ffmpeg` is available
- `src/assets/metro-escape.wav`
- `src/assets/metro-escape.mp3` when `ffmpeg` is available

## Coverage

`npm run test:browser` switches to `Metro Escape`, starts the game, verifies the selected soundtrack log appears, and checks the debug hook reports `metro-escape` as the active track.
