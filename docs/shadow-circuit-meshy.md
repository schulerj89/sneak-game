# Shadow Circuit Meshy Workflow

The project has a local Codex MCP config for Meshy:

```toml
[mcp_servers.meshy]
command = "npx"
args = [ "-y", "@meshy-ai/meshy-mcp-server" ]
```

The committed config intentionally does not include an API key. To use the MCP server or generate production assets, set a real key outside git before launching Codex or running the asset script:

```powershell
$env:MESHY_API_KEY = "<real Meshy key>"
npm run assets:meshy-objectives
npm run assets:meshy-characters
```

The objective script uses Meshy's Image to 3D workflow with committed reference PNGs:

- Generate or refresh the source plates with `npm run assets:objective-references`.
- Create Image to 3D tasks from `src/assets/objectives/reference/ultra-keycard-reference.png` and `src/assets/objectives/reference/ultra-terminal-reference.png`.
- Request `meshy-6`, PBR texturing, `remove_lighting`, integrated `should_remesh`, triangle topology, and GLB output.
- Download the GLB only after the task succeeds and reject the output if it exceeds the configured size budget.
- Store non-secret task metadata in `tools/meshy/generated/objectives` and accepted preview renders in `docs/2026-06-18-meshy-objective-upgrade/previews`.

Default runtime assets:

- `src/assets/objectives/keycard-cinematic.glb`
- `src/assets/objectives/terminal-cinematic.glb`
- `src/assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb`
- `src/assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb`
- `src/assets/characters/sentry/enemy_sentry.glb`

Memory first and Balanced quality use the existing lightweight runtime geometry. Cinematic quality preloads the GLBs during the level loading screen and reuses the same assets across every stage.

## Character Generation

`npm run assets:meshy-characters` targets Meshy's Image to 3D, Rigging, and Animation APIs:

- Hero reference: `src/assets/characters/reference/shadow-circuit-hero-reference.png`.
- Sentry reference: `src/assets/characters/reference/shadow-circuit-sentry-reference.png`.
- Image to 3D uses `ai_model: "meshy-6"`, `model_type: "standard"`, `should_texture: true`, PBR enabled, 4K base texture, A-pose, quad remesh, and `target_formats: ["glb"]`.
- Rigging requests basic walking/running animations where Meshy can provide them.
- Animation library action IDs are documented by Meshy. The script targets `30` (`Casual_Walk`) for generated hero experiments and `2` (`Alert`) for the sentry.
- Generated assets must remain below `MESHY_MAX_CHARACTER_BYTES` before they are written.
- `--only=hero` or `--only=sentry` can regenerate a single character without rerunning both.

The active hero runtime asset currently comes from the supplied extracted GLBs in `src/assets/hero/`, not the generated `hero-cinematic.glb` output. The runtime loads only the idle and Run_02 clips and ignores walking/run_03 variants.

The active sentry runtime asset is the supplied static `src/assets/characters/sentry/enemy_sentry.glb`. It does not include animation clips; the game applies hover, patrol yaw, and the front spotlight in code.

If `MESHY_API_KEY` is not available, use the local fallback writer:

```powershell
$env:MESHY_CHARACTER_FALLBACK = "true"
npm run assets:meshy-characters
```

The fallback GLBs are intentionally small, deterministic, and replaceable. They keep the runtime path testable if Meshy is unavailable, but the production character assets are the larger Meshy Image-to-3D outputs with embedded animation clips.

Use test mode only to verify API plumbing without overwriting runtime assets:

```powershell
$env:MESHY_TEST_MODE = "true"
npm run assets:meshy-objectives
```

Test mode uses Meshy's documented dummy key and writes to `artifacts/meshy-test-objectives` by default.
