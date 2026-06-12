import { distance, dot, normalize, segmentIntersectsRect, subtract } from './math';
import type { DetectionLeniency, DetectionState, EnemySpec, LevelDefinition, SuspicionState, Vec2 } from './types';

const suspicionProfiles: Record<DetectionLeniency, { gainPerSecond: number; decayPerSecond: number }> = {
  forgiving: { gainPerSecond: 0.72, decayPerSecond: 0.8 },
  standard: { gainPerSecond: 1.08, decayPerSecond: 0.66 },
  sharp: { gainPerSecond: 1.52, decayPerSecond: 0.5 },
};

export function isInsideVisionCone(
  enemyPosition: Vec2,
  facing: Vec2,
  playerPosition: Vec2,
  enemy: Pick<EnemySpec, 'visionAngleDegrees' | 'visionRange'>,
): boolean {
  const toPlayer = subtract(playerPosition, enemyPosition);
  const range = distance(enemyPosition, playerPosition);
  if (range > enemy.visionRange) {
    return false;
  }

  const forward = normalize(facing);
  const targetDirection = normalize(toPlayer);
  const halfAngle = (enemy.visionAngleDegrees * Math.PI) / 360;
  return dot(forward, targetDirection) >= Math.cos(halfAngle);
}

export function isSightBlocked(level: LevelDefinition, from: Vec2, to: Vec2): boolean {
  return level.obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle, 0.12));
}

export function getDetectionState(
  level: LevelDefinition,
  enemy: EnemySpec,
  enemyPosition: Vec2,
  facing: Vec2,
  playerPosition: Vec2,
): DetectionState {
  const inCone = isInsideVisionCone(enemyPosition, facing, playerPosition, enemy);
  const rayBlocked = inCone ? isSightBlocked(level, enemyPosition, playerPosition) : false;
  const spotted = inCone && !rayBlocked;

  return {
    spotted,
    enemyId: spotted ? enemy.id : null,
    rayBlocked,
    distance: distance(enemyPosition, playerPosition),
  };
}

export function advanceSuspicion(
  previous: SuspicionState,
  detection: DetectionState,
  deltaSeconds: number,
  leniency: DetectionLeniency,
): SuspicionState {
  const profile = suspicionProfiles[leniency];
  const delta = Math.max(0, deltaSeconds);
  const nextValue = detection.spotted
    ? Math.min(1, previous.value + profile.gainPerSecond * delta)
    : Math.max(0, previous.value - profile.decayPerSecond * delta);

  return {
    value: nextValue,
    status: nextValue >= 1 ? 'detected' : nextValue > 0.08 ? 'suspicious' : 'hidden',
    enemyId: detection.spotted ? detection.enemyId : nextValue > 0.08 ? previous.enemyId : null,
  };
}

export function emptySuspicion(): SuspicionState {
  return { value: 0, status: 'hidden', enemyId: null };
}
