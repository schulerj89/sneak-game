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
```

The script uses Meshy's Text to 3D v2 two-step workflow:

- Create preview tasks with `mode: "preview"`, `should_remesh: true`, `topology: "triangle"`, low `target_polycount`, and `target_formats: ["glb"]`.
- Optionally pass `--refine` to create textured refine tasks with `mode: "refine"` and `target_formats: ["glb"]`.
- Download the GLB only after the task succeeds and reject the output if it exceeds the configured size budget.

Default runtime assets:

- `src/assets/objectives/keycard-cinematic.glb`
- `src/assets/objectives/terminal-cinematic.glb`

Memory first and Balanced quality use the existing lightweight runtime geometry. Cinematic quality preloads the GLBs during the level loading screen and reuses the same assets across every stage.

Use test mode only to verify API plumbing without overwriting runtime assets:

```powershell
$env:MESHY_TEST_MODE = "true"
npm run assets:meshy-objectives
```

Test mode uses Meshy's documented dummy key and writes to `artifacts/meshy-test-objectives` by default.
