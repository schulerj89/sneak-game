# Shadow Circuit Soundtrack

Shadow Circuit ships downloaded external tracks only:

- `Ghost Steps`
- `Cyberpunk Moonlight`
- `Dark Sci-Fi: Sector`
- `Dark Sci-Fi: Pulse`
- `Dark Sci-Fi: Urgent`

The settings menu exposes a soundtrack selector. Runtime playback uses one `HTMLAudioElement` and swaps the source when the selected track changes, which avoids keeping multiple decoded tracks active in memory.

`Ghost Steps` is the default mix. It is an external CC-BY 4.0 track from OpenGameArt with cyberpunk, stealth, ambient, and loop tags. `Cyberpunk Moonlight` is a CC0 external track from OpenGameArt with a slower synth pulse. `Dark Sci-Fi: Sector`, `Dark Sci-Fi: Pulse`, and `Dark Sci-Fi: Urgent` come from SRG774's CC0 loopable sci-fi pack and add calmer, pulsing, and tense options. The dark sci-fi MP3s are normalized in-repo because the source files were much quieter than the rest of the soundtrack. The game imports runtime music as MP3 so the payload stays smaller than full WAV loops.

## License Manifest

External tracks must keep their original source, license, and attribution in `src/game/audio.ts`.

Current external attribution:

- `"Ghost Steps" from "Code Injection Dark Techno Music Pack" by DavidKBD. License: CC BY 4.0. Includes tracks by Tsorthan Grove: "Morbid technology" and "Dark Ambient Drone #2", CC-BY 4.0. Source: https://opengameart.org/content/ghost-steps-davidkbd-vs-tsorthan-grove`
- `"Cyberpunk Moonlight Sonata v2" by Joth. License: CC0. Attribution appreciated, but not required. Source: https://opengameart.org/content/cyberpunk-moonlight-sonata`
- `"Sector" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Pulse" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Urgent" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`

When external royalty-free tracks are added, each track must include:

- Track title.
- Author or source account.
- Original source URL.
- License name and license URL when available.
- Required attribution text, or a note that attribution is not required.
- Any Content ID or redistribution caveats.

## Coverage

`npm run test:browser` switches through every soundtrack option, verifies the debug hook reports the selected track, and checks the shared `HTMLAudioElement` is loaded, unpaused, error-free, and audible by volume setting before starting the game with `Cyberpunk Moonlight`.
