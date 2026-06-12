import { distance, pointInRect } from './math';
import type { RectObstacle, Vec2 } from './types';

export const playerRadius = 0.28;
export const enemyRadius = 0.34;

export type EnemyCollisionBody = Readonly<{
  id: string;
  position: Vec2;
  radius: number;
}>;

export function collidesWithObstacles(point: Vec2, obstacles: readonly RectObstacle[], radius: number): boolean {
  return obstacles.some((obstacle) => pointInRect(point, obstacle, radius));
}

export function collidesWithEnemies(point: Vec2, enemies: readonly EnemyCollisionBody[], radius: number): EnemyCollisionBody | null {
  return enemies.find((enemy) => distance(point, enemy.position) <= radius + enemy.radius) ?? null;
}
