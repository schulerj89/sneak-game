import type { DebugSample, DetectionState, GameSettings, LevelDefinition, Vec2 } from './types';

type MemoryPerformance = Performance & {
  memory?: {
    usedJSHeapSize: number;
  };
};

export class DebugPanel {
  private lastTime = performance.now();
  private smoothedFps = 60;

  constructor(private readonly element: HTMLElement) {}

  sample(now: number, drawCalls: number, triangles: number): DebugSample {
    const frameMs = Math.max(0.01, now - this.lastTime);
    this.lastTime = now;
    const fps = 1000 / frameMs;
    this.smoothedFps = this.smoothedFps * 0.88 + fps * 0.12;
    const memory = (performance as MemoryPerformance).memory;

    return {
      fps: this.smoothedFps,
      frameMs,
      usedMemoryMb: memory ? memory.usedJSHeapSize / 1024 / 1024 : null,
      drawCalls,
      triangles,
    };
  }

  render(
    settings: GameSettings,
    level: LevelDefinition,
    playerPosition: Vec2,
    detection: DetectionState,
    sample: DebugSample,
  ): void {
    this.element.hidden = !settings.debugEnabled;
    if (!settings.debugEnabled) return;

    this.element.innerHTML = `
      <div class="debug-title">DEBUG</div>
      <div>Level: ${level.name}</div>
      <div>Player: ${playerPosition.x.toFixed(2)}, ${playerPosition.z.toFixed(2)}</div>
      <div>Detection: ${detection.spotted ? `SPOTTED by ${detection.enemyId}` : 'clear'}</div>
      <div>Ray blocked: ${detection.rayBlocked ? 'yes' : 'no'}</div>
      <div>FPS: ${sample.fps.toFixed(0)} (${sample.frameMs.toFixed(1)}ms)</div>
      <div>Memory: ${sample.usedMemoryMb === null ? 'n/a' : `${sample.usedMemoryMb.toFixed(1)} MB`}</div>
      <div>Draws: ${sample.drawCalls} Triangles: ${sample.triangles}</div>
      <div>Quality: ${settings.quality}</div>
    `;
  }
}
