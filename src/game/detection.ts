import { distance, dot, normalize, segmentIntersectsRect, subtract } from './math';
import type { DetectionState, EnemySpec, LevelDefinition, Vec2 } from './types';

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
