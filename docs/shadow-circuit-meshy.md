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

The script uses Meshy's Text to 3D v2 two-step workflow:

- Create preview tasks with `mode: "preview"`, `should_remesh: true`, `topology: "triangle"`, low `target_polycount`, and `target_formats: ["glb"]`.
- Optionally pass `--refine` to create textured refine tasks with `mode: "refine"` and `target_formats: ["glb"]`.
- Download the GLB only after the task succeeds and reject the output if it exceeds the configured size budget.

Default runtime assets:

- `src/assets/objectives/keycard-cinematic.glb`
- `src/assets/objectives/terminal-cinematic.glb`
- `src/assets/characters/hero-cinematic.glb`
- `src/assets/characters/sentry-cinematic.glb`

Memory first and Balanced quality use the existing lightweight runtime geometry. Cinematic quality preloads the GLBs during the level loading screen and reuses the same assets across every stage.

## Character Generation

`npm run assets:meshy-characters` targets Meshy's Text to 3D, Rigging, and Animation APIs:

- Hero prompt: low-poly humanoid stealth infiltrator with clear limbs, teal suit, and cyan visor.
- Sentry prompt: low-poly humanoid security sentry with red armor and amber visor.
- Rigging requests basic walking/running animations where Meshy can provide them.
- Animation library action IDs are documented by Meshy. The script targets `30` (`Casual_Walk`) for the hero fallback action and `2` (`Alert`) for the sentry.
- Generated assets must remain below `MESHY_MAX_CHARACTER_BYTES` before they are written.

If `MESHY_API_KEY` is not available, use the local fallback writer:

```powershell
$env:MESHY_CHARACTER_FALLBACK = "true"
npm run assets:meshy-characters
```

The fallback GLBs are intentionally small, deterministic, and replaceable. They keep the runtime path testable until a real keyed Meshy run can generate and download production outputs.

Use test mode only to verify API plumbing without overwriting runtime assets:

```powershell
$env:MESHY_TEST_MODE = "true"
npm run assets:meshy-objectives
```

Test mode uses Meshy's documented dummy key and writes to `artifacts/meshy-test-objectives` by default.
