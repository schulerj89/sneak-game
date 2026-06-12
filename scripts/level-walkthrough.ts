import { getDetectionState } from '../src/game/detection';
import { levels } from '../src/game/levels';
import { distance, lerp, normalize, pointInRect, subtract } from '../src/game/math';
import type { EnemySpec, Vec2 } from '../src/game/types';

const stepSize = 0.18;
const guardSamples = 16;

type MovingGuard = {
  spec: EnemySpec;
  position: Vec2;
  facing: Vec2;
};

let failures = 0;

for (const level of levels) {
  const route = level.validationRoute;
  const guards = level.enemies.map((enemy) => ({
    spec: enemy,
    position: enemy.start,
    facing: normalize(subtract(enemy.patrol[1] ?? enemy.start, enemy.start)),
  }));

  for (let routeIndex = 1; routeIndex < route.length; routeIndex += 1) {
    const from = route[routeIndex - 1];
    const to = route[routeIndex];
    const steps = Math.max(1, Math.ceil(distance(from, to) / stepSize));

    for (let step = 0; step <= steps; step += 1) {
      const point = lerp(from, to, step / steps);
      assertInBounds(level.id, point, level.floorSize);
      assertNoObstacle(level.id, point, level.obstacles);
      assertHasClearPatrolWindow(level.id, point, level, guards);
    }
  }
}

if (failures > 0) {
  console.error(`[walkthrough] ${failures} validation failure(s)`);
  process.exitCode = 1;
} else {
  console.info(`[walkthrough] validated ${levels.length} levels and ${levels.reduce((sum, level) => sum + level.validationRoute.length, 0)} route waypoints`);
}

function assertInBounds(levelId: string, point: Vec2, floorSize: Vec2): void {
  if (Math.abs(point.x) > floorSize.x / 2 || Math.abs(point.z) > floorSize.z / 2) {
    fail(`${levelId}: route point outside room (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`);
  }
}

function assertNoObstacle(levelId: string, point: Vec2, obstacles: readonly { center: Vec2; size: Vec2; id: string }[]): void {
  for (const obstacle of obstacles) {
    if (pointInRect(point, { ...obstacle, height: 1 }, 0.24)) {
      fail(`${levelId}: route point intersects ${obstacle.id}`);
    }
  }
}

function assertHasClearPatrolWindow(
  levelId: string,
  point: Vec2,
  level: (typeof levels)[number],
  guards: readonly MovingGuard[],
): void {
  const clearWindow = Array.from({ length: guardSamples }, (_, sampleIndex) => sampleIndex / guardSamples).some((phase) => {
    return guards.every((guard) => {
      const { position, facing } = sampleGuard(guard.spec, phase);
      return !getDetectionState(level, guard.spec, position, facing, point).spotted;
    });
  });

  if (!clearWindow) {
    fail(`${levelId}: no sampled clear patrol window at ${point.x.toFixed(2)}, ${point.z.toFixed(2)}`);
  }
}

function sampleGuard(spec: EnemySpec, phase: number): { position: Vec2; facing: Vec2 } {
  const segmentCount = spec.patrol.length;
  const scaled = phase * segmentCount;
  const fromIndex = Math.floor(scaled) % segmentCount;
  const toIndex = (fromIndex + 1) % segmentCount;
  const from = spec.patrol[fromIndex];
  const to = spec.patrol[toIndex];
  return {
    position: lerp(from, to, scaled - Math.floor(scaled)),
    facing: normalize(subtract(to, from)),
  };
}

function fail(message: string): void {
  failures += 1;
  console.error(`[walkthrough] ${message}`);
}
