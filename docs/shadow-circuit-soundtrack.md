# Shadow Circuit Soundtrack

Shadow Circuit ships downloaded external tracks only:

- `Ghost Steps`
- `Cyberpunk Moonlight`
- `Dark Sci-Fi: Sector`
- `Dark Sci-Fi: Airy`
- `Dark Sci-Fi: Pulse`
- `Dark Sci-Fi: Urgent`
- `Dark Sci-Fi: Transmission`
- `Insistent`
- `Future Loading Loop`
- `Lost Signal`
- `Background Space`
- `Ambient Horror 01`
- `On Patrol` title/character-select music

The settings menu exposes a soundtrack selector for manual preview. Normal gameplay assigns a different downloaded track per level through `levelSoundtrackIds`; the title and character-select screens use the separate `On Patrol` menu track. Runtime playback uses one `HTMLAudioElement` and swaps the source when the selected track changes, which avoids keeping multiple decoded tracks active in memory.

`Ghost Steps` is the default settings selection. It is an external CC-BY 4.0 track from OpenGameArt with cyberpunk, stealth, ambient, and loop tags. `Cyberpunk Moonlight` is a CC0 external track from OpenGameArt with a slower synth pulse. The five `Dark Sci-Fi` tracks come from SRG774's CC0 loopable sci-fi pack and add calmer, pulsing, tense, airy, and transmission-like options. `Insistent`, `Future Loading Loop`, `Background Space`, `Ambient Horror 01`, `Lost Signal`, and `On Patrol` round out the per-level and menu rotation. The game imports runtime music as compressed audio where possible so the payload stays smaller than full WAV loops.

## License Manifest

External tracks must keep their original source, license, and attribution in `src/game/audio.ts`.

Current external attribution:

- `"Ghost Steps" from "Code Injection Dark Techno Music Pack" by DavidKBD. License: CC BY 4.0. Includes tracks by Tsorthan Grove: "Morbid technology" and "Dark Ambient Drone #2", CC-BY 4.0. Source: https://opengameart.org/content/ghost-steps-davidkbd-vs-tsorthan-grove`
- `"Cyberpunk Moonlight Sonata v2" by Joth. License: CC0. Attribution appreciated, but not required. Source: https://opengameart.org/content/cyberpunk-moonlight-sonata`
- `"Sector" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Airy" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Pulse" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Urgent" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Transmission" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required. Source: https://opengameart.org/content/dark-sci-fi-audio-pack`
- `"Insistent" by yd. License: CC0. Attribution is not required. Source: https://opengameart.org/content/insistent-background-loop`
- `"Loading screen loop" by Brandon Morris, submitted by HaelDB. License: CC0. Attribution is not required. Source: https://opengameart.org/content/loading-screen-loop`
- `"Sci-Fi electronic [lost signal]" by PetterTheSturgeon. License: CC BY 3.0. Source: https://opengameart.org/content/sci-fi-electronic-lost-signal`
- `"Background space track" by yd. License: CC0. Attribution is not required. Source: https://opengameart.org/content/background-space-track`
- `"Ambient Horror Track 01" by Cleyton Kauffman. License: CC0. Attribution is not required. Source: https://opengameart.org/content/ambient-horror-track-01`
- `"On Patrol" by Section 31. License: CC0. Attribution is not required. Source: https://opengameart.org/content/on-patrol`

When external royalty-free tracks are added, each track must include:

- Track title.
- Author or source account.
- Original source URL.
- License name and license URL when available.
- Required attribution text, or a note that attribution is not required.
- Any Content ID or redistribution caveats.

## Coverage

`npm run test:browser` switches through every soundtrack option, verifies the debug hook reports the selected track, and checks the shared `HTMLAudioElement` is loaded, unpaused, error-free, and audible by volume setting. Gameplay checks also verify that level one starts with its assigned track instead of depending on the settings dropdown value.
