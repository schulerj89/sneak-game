import type {
  DebugSample,
  DetectionState,
  GameSettings,
  LevelDefinition,
  ObjectiveProgress,
  SuspicionState,
  Vec2,
} from './types';
import type { PickupDebugSample } from './pickupDiagnostics';
import { memoryCapMb, targetFps } from './settings';

type MemoryPerformance = Performance & {
  memory?: {
    usedJSHeapSize: number;
  };
};

export class DebugPanel {
  private lastTime = performance.now();
  private smoothedFps = 60;

  constructor(private readonly element: HTMLElement) {}

  sample(now: number, drawCalls: number, triangles: number, reservedMemoryMb: number): DebugSample {
    const frameMs = Math.max(0.01, now - this.lastTime);
    this.lastTime = now;
    const fps = 1000 / frameMs;
    this.smoothedFps = this.smoothedFps * 0.88 + fps * 0.12;
    const memory = (performance as MemoryPerformance).memory;

    return {
      fps: this.smoothedFps,
      frameMs,
      usedMemoryMb: memory ? memory.usedJSHeapSize / 1024 / 1024 : null,
      memoryCapMb,
      reservedMemoryMb,
      memoryPressure: memory ? (memory.usedJSHeapSize / 1024 / 1024 > memoryCapMb ? 'over-cap' : 'ok') : 'unknown',
      drawCalls,
      triangles,
    };
  }

  render(
    settings: GameSettings,
    level: LevelDefinition,
    playerPosition: Vec2,
    detection: DetectionState,
    suspicion: SuspicionState,
    objectives: ObjectiveProgress,
    sample: DebugSample,
    pickup: PickupDebugSample,
    activeTrackId: string | null,
  ): void {
    this.element.hidden = !settings.debugEnabled;
    if (!settings.debugEnabled) return;

    this.element.innerHTML = `
      <div class="debug-title">DEBUG</div>
      <div>Level: ${level.name}</div>
      <div>Player: ${playerPosition.x.toFixed(2)}, ${playerPosition.z.toFixed(2)}</div>
      <div>Detection: ${detection.spotted ? `SPOTTED by ${detection.enemyId}` : 'clear'}</div>
      <div>Suspicion: ${suspicion.status} ${(suspicion.value * 100).toFixed(0)}%</div>
      <div>Ray blocked: ${detection.rayBlocked ? 'yes' : 'no'}</div>
      <div>Objectives: ${objectives.collectedRequired}/${objectives.totalRequired} ${objectives.exitUnlocked ? 'unlocked' : 'locked'}</div>
      <div>FPS: ${sample.fps.toFixed(0)} (${sample.frameMs.toFixed(1)}ms)</div>
      <div>Target FPS: ${targetFps}</div>
      <div>Memory: ${sample.usedMemoryMb === null ? 'n/a' : `${sample.usedMemoryMb.toFixed(1)} MB`} / ${sample.memoryCapMb} MB</div>
      <div>Reserve: ${sample.reservedMemoryMb.toFixed(0)} MB</div>
      <div>Pressure: ${sample.memoryPressure}</div>
      <div>Draws: ${sample.drawCalls} Triangles: ${sample.triangles}</div>
      <div>Quality: ${settings.quality}</div>
      <div>Track: ${activeTrackId ?? settings.soundtrackId}</div>
      <div>Pickup: ${pickup.id ? `${pickup.label} (${pickup.id})` : 'none'}</div>
      <div>Pickup cost: ${pickup.totalMs.toFixed(1)}ms total | audio ${pickup.audioMs.toFixed(1)}ms | UI ${pickup.uiMs.toFixed(1)}ms</div>
      <div>Pickup detail: collect ${pickup.collectMs.toFixed(1)}ms | mesh ${pickup.meshMs.toFixed(1)}ms | frame ${pickup.frameSpikeMs.toFixed(1)}ms/${pickup.framesObserved}f</div>
      <div>Pickup audio: ${pickup.audio.status} ${pickup.audio.contextState} | buffer ${pickup.audio.bufferReady ? 'ready' : 'missing'} | new ${pickup.audio.bufferCreated ? 'yes' : 'no'} | gain ${pickup.audio.gain.toFixed(2)}</div>
    `;
  }
}
