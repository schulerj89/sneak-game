# Shadow Circuit Soundtrack

Shadow Circuit ships downloaded external tracks only:

- `Ghost Steps`
- `Cyberpunk Moonlight`

The settings menu exposes a soundtrack selector. Runtime playback uses one `HTMLAudioElement` and swaps the source when the selected track changes, which avoids keeping multiple decoded tracks active in memory.

`Ghost Steps` is the default mix. It is an external CC-BY 4.0 track from OpenGameArt with cyberpunk, stealth, ambient, and loop tags. `Cyberpunk Moonlight` is a CC0 external track from OpenGameArt with a slower synth pulse. The game imports runtime music as MP3 so the payload stays smaller than full WAV loops.

## License Manifest

External tracks must keep their original source, license, and attribution in `src/game/audio.ts`.

Current external attribution:

- `"Ghost Steps" from "Code Injection Dark Techno Music Pack" by DavidKBD. License: CC BY 4.0. Includes tracks by Tsorthan Grove: "Morbid technology" and "Dark Ambient Drone #2", CC-BY 4.0. Source: https://opengameart.org/content/ghost-steps-davidkbd-vs-tsorthan-grove`
- `"Cyberpunk Moonlight Sonata v2" by Joth. License: CC0. Attribution appreciated, but not required. Source: https://opengameart.org/content/cyberpunk-moonlight-sonata`

When external royalty-free tracks are added, each track must include:

- Track title.
- Author or source account.
- Original source URL.
- License name and license URL when available.
- Required attribution text, or a note that attribution is not required.
- Any Content ID or redistribution caveats.

## Coverage

`npm run test:browser` switches to `Cyberpunk Moonlight`, starts the game, verifies the selected soundtrack log appears, and checks the debug hook reports `cyberpunk-moonlight` as the active track.
