export type Vec2 = Readonly<{
  x: number;
  z: number;
}>;

export type RectObstacle = Readonly<{
  id: string;
  center: Vec2;
  size: Vec2;
  height: number;
}>;

export type LightSpec = Readonly<{
  id: string;
  position: Vec2;
  height: number;
  color: string;
  intensity: number;
  radius: number;
}>;

export type EnemySpec = Readonly<{
  id: string;
  start: Vec2;
  patrol: readonly Vec2[];
  speed: number;
  visionRange: number;
  visionAngleDegrees: number;
  pauseSeconds: number;
}>;

export type LevelDefinition = Readonly<{
  id: string;
  name: string;
  briefing: string;
  floorSize: Vec2;
  start: Vec2;
  goal: Vec2;
  goalRadius: number;
  obstacles: readonly RectObstacle[];
  lights: readonly LightSpec[];
  enemies: readonly EnemySpec[];
  validationRoute: readonly Vec2[];
}>;

export type RenderQuality = 'memory' | 'balanced' | 'cinematic';

export type SoundtrackId = 'shadow-circuit' | 'pulse-runner' | 'deep-cover';

export type GameSettings = {
  quality: RenderQuality;
  musicEnabled: boolean;
  debugEnabled: boolean;
  masterVolume: number;
  soundtrackId: SoundtrackId;
};

export type GamePhase = 'menu' | 'playing' | 'paused' | 'caught' | 'complete' | 'settings' | 'level-select';

export type DetectionState = Readonly<{
  spotted: boolean;
  enemyId: string | null;
  rayBlocked: boolean;
  distance: number;
}>;

export type DebugSample = Readonly<{
  fps: number;
  frameMs: number;
  usedMemoryMb: number | null;
  memoryCapMb: number;
  reservedMemoryMb: number;
  memoryPressure: 'unknown' | 'ok' | 'over-cap';
  drawCalls: number;
  triangles: number;
}>;
