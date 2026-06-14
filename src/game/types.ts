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

export type ObjectiveType = 'keycard' | 'terminal';

export type ObjectiveDefinition = Readonly<{
  id: string;
  type: ObjectiveType;
  label: string;
  position: Vec2;
  radius: number;
  required: boolean;
}>;

export type LevelDefinition = Readonly<{
  id: string;
  name: string;
  briefing: string;
  parSeconds: number;
  floorSize: Vec2;
  start: Vec2;
  goal: Vec2;
  goalRadius: number;
  obstacles: readonly RectObstacle[];
  lights: readonly LightSpec[];
  enemies: readonly EnemySpec[];
  objectives?: readonly ObjectiveDefinition[];
  validationRoute: readonly Vec2[];
}>;

export type RenderQuality = 'memory' | 'balanced' | 'cinematic';

export type DetectionLeniency = 'forgiving' | 'standard' | 'sharp';

export type SoundtrackId = 'ghost-steps' | 'night-ops' | 'shadow-circuit' | 'pulse-runner' | 'deep-cover' | 'metro-escape';

export type GameSettings = {
  quality: RenderQuality;
  musicEnabled: boolean;
  debugEnabled: boolean;
  masterVolume: number;
  soundtrackId: SoundtrackId;
  detectionLeniency: DetectionLeniency;
};

export type GamePhase = 'loading' | 'menu' | 'playing' | 'paused' | 'caught' | 'complete' | 'settings' | 'level-select';

export type LoadingProgress = Readonly<{
  value: number;
  label: string;
}>;

export type PickupAudioDebug = Readonly<{
  status: 'idle' | 'muted' | 'played' | 'error';
  setupMs: number;
  contextState: string;
  samplesReady: boolean;
  bufferReady: boolean;
  bufferCreated: boolean;
  effectsPrimed: boolean;
  gain: number;
}>;

export type DetectionState = Readonly<{
  spotted: boolean;
  enemyId: string | null;
  rayBlocked: boolean;
  distance: number;
}>;

export type SuspicionStatus = 'hidden' | 'suspicious' | 'detected';

export type SuspicionState = Readonly<{
  value: number;
  status: SuspicionStatus;
  enemyId: string | null;
}>;

export type ObjectiveProgress = Readonly<{
  totalRequired: number;
  collectedRequired: number;
  exitUnlocked: boolean;
  collectedIds: readonly string[];
  items: readonly Readonly<{
    id: string;
    type: ObjectiveType;
    label: string;
    required: boolean;
    collected: boolean;
  }>[];
}>;

export type RunGrade = 'S' | 'A' | 'B' | 'C';

export type RunSummary = Readonly<{
  elapsedMs: number;
  parSeconds: number;
  alerts: number;
  score: number;
  grade: RunGrade;
  bestTimeMs: number | null;
  isNewBest: boolean;
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

export type PickupDebugSample = Readonly<{
  id: string | null;
  label: string;
  collectedAtMs: number | null;
  totalMs: number;
  collectMs: number;
  meshMs: number;
  audioMs: number;
  uiMs: number;
  frameSpikeMs: number;
  framesObserved: number;
  audio: PickupAudioDebug;
}>;
