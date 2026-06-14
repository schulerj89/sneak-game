# Shadow Circuit Improvement Decision - 06/12/2026

This decision record chooses the next three improvement tracks for Shadow Circuit. The requested date format is `MM/DD/YYYY`; the filename uses hyphens because `/` is not valid in Windows filenames.

## Decision Summary

Chosen improvements:

1. Suspicion meter and alert recovery.
2. Objective variants: terminals, keycards, and locked exits.
3. Licensed soundtrack replacement pipeline.

The sub-agent review recommended suspicion buildup, progress/best times, and objective variants after inspecting the codebase and running `npm run test:run`. I kept suspicion and objective variants, then elevated the soundtrack pipeline because direct player feedback called out the current music as a weak point.

## Context

At this checkpoint, Shadow Circuit had five playable levels, visible guard cones, collision detection, a level select screen, settings, screenshots, generated WAV tracks, shader polish, and a 75 MB browser heap cap. The strongest improvements should add player-visible value without breaking the existing lightweight runtime.

## Music Research

- Pixabay: the Content License allows free use, no required attribution, and modification, but it prohibits standalone resale and warns that some rights can still require checking. Pixabay also documents Content ID handling and license certificates for audio claims. Sources: https://pixabay.com/service/license-summary/ and https://pixabay.com/blog/posts/how-to-clear-a-youtube-content-id-claim-with-a-pix-190/
- OpenGameArt: commercial game use is generally allowed when the specific asset license permits it, but the exact track license matters. CC0 is easiest; CC-BY and OGA-BY require attribution; CC-BY-SA adds share-alike and DRM constraints that need care. Source: https://opengameart.org/content/faq
- Incompetech: Creative Commons music is free when credited, while a paid standard license is available when attribution is not wanted or practical. Source: https://incompetech.com/music/royalty-free/licenses/

The safest music path is to shortlist CC0, OGA-BY, CC-BY, or clearly documented Pixabay tracks, record the exact source and license in `docs/shadow-circuit-soundtrack.md`, and avoid non-commercial, unclear, or share-alike tracks unless the release target is compatible.

## Selected Feature 1: Suspicion Meter And Alert Recovery

Pros:

- Makes stealth less binary than the current instant-caught feel.
- Gives players a readable recovery window after briefly crossing a cone.
- Builds on the existing detection state and HUD/debug systems.
- Adds almost no memory pressure.

Cons:

- Existing patrol timing and authored routes need retuning.
- The browser smoke test and level route validator need to represent detection buildup, not just binary visibility.
- Poor tuning could make guards feel either harmless or unfair.

Reasoning:

This is the highest value gameplay improvement because it changes how every level feels without requiring new art, new levels, or a large system rewrite. It also pairs well with settings: a future accessibility option could expose detection leniency without increasing memory use.

Testing:

- Unit-test suspicion buildup, decay, and caught thresholds.
- Extend route validation to account for exposure time.
- Browser smoke should assert the HUD changes from hidden to suspicious to detected during controlled exposure.

Memory and settings impact:

- Store only a few numeric fields per run.
- No asset increase.
- Optional future setting: detection leniency.

## Selected Feature 2: Objective Variants

Pros:

- Adds variety without requiring an immediate jump from five to many more levels.
- Makes levels more memorable by adding terminals, keycards, and locked exits.
- Reuses the existing level data, mesh, collision, UI, and validation structure.
- Small meshes and icons should stay well inside the current memory budget.

Cons:

- Adds per-level runtime state and more completion rules.
- The level validator becomes more complex because a valid route must collect required objectives before exiting.
- UI copy and objective markers need to stay readable on smaller screens.

Reasoning:

More levels are valuable, but objective variants are a better first investment because they create reusable mechanics. Once the rules are stable, future levels can use combinations of those mechanics instead of only different patrol layouts.

Testing:

- Add `levels.test.ts` coverage for required objective metadata.
- Extend `level-walkthrough.ts` to validate objective pickup order before the exit.
- Browser smoke should complete at least one objective-gated level and verify the locked exit cannot complete early.

Memory and settings impact:

- Small added geometry and UI state.
- Keep objective meshes simple and reuse materials.
- Optional future setting: objective marker intensity for readability.

## Selected Feature 3: Licensed Soundtrack Replacement Pipeline

Pros:

- Directly addresses the weak low-hum music feedback.
- MP3 or compressed audio can sound much better than generated WAV loops while reducing download size.
- Track-specific tension, stealth, and chase loops can make levels feel more alive.
- A license manifest prevents future uncertainty about where each track came from.

Cons:

- External music introduces license and attribution obligations.
- Browser autoplay restrictions still require user interaction before playback.
- Multiple decoded audio files can increase memory if preloaded carelessly.
- Content ID can still be a friction point for captured gameplay videos, especially with some Pixabay tracks.

Reasoning:

The current generated audio is technically safe but not strong enough as a player-facing asset. The implementation should not just drop in random MP3 files; it should add a small source/license workflow, pick a limited number of tracks, and keep playback memory controlled.

Testing:

- Unit-test soundtrack metadata so every external track has title, author, URL, license, and attribution text when required.
- Browser smoke should switch tracks in settings and verify only the selected track is active.
- Manual audio check should confirm loop points, volume, tempo, and bass are appropriate.

Memory and settings impact:

- Prefer compressed MP3 or Ogg over large WAV files when licensing allows redistribution.
- Keep one active `HTMLAudioElement`; do not decode the whole soundtrack at startup.
- Add settings for music volume and selected track; keep existing quality fallback independent from audio.

## Not Chosen For This Round

- Progress, best times, and badges: strong candidate with low risk, but it depends on having enough varied objectives and balanced suspicion rules to make achievements meaningful.
- More levels: useful, but new mechanics should come first so extra levels are not just more patrol mazes.
- Character/logo asset pass: good polish, but lower gameplay impact than detection, objectives, and music.
- Guard behavior variants: promising, but best after suspicion buildup is stable so new guard modes do not multiply tuning risk.
- Crouch/sprint/noise: interesting, but it could undermine authored patrol timing and needs more accessibility work.
- Debug route recorder: useful for development, but less player-visible.
- Renderer/resource hardening: valuable as a support task when objectives and audio add assets, but not a headline feature by itself.

## Implementation Order

1. Add suspicion meter logic, HUD, and tests.
2. Add one objective-gated prototype level path and validator support.
3. Add soundtrack metadata, license documentation, and one replacement compressed track candidate.

This order reduces risk: the first two features define the gameplay shape, and the soundtrack pipeline can then choose tracks that match the new pacing instead of replacing music blindly.
