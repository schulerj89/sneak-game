import { describe, expect, it } from 'vitest';
import { collidesWithEnemies, collidesWithObstacles, enemyRadius, playerRadius } from './collision';
import { levels } from './levels';

describe('collision helpers', () => {
  it('blocks player movement into cover with padding', () => {
    expect(collidesWithObstacles({ x: -3.1, z: -0.7 }, levels[0].obstacles, playerRadius)).toBe(true);
  });

  it('detects contact between player and enemies', () => {
    const enemy = { id: 'test-guard', position: { x: 1, z: 1 }, radius: enemyRadius };
    expect(collidesWithEnemies({ x: 1.2, z: 1.1 }, [enemy], playerRadius)?.id).toBe('test-guard');
  });

  it('does not report enemy collision outside combined radii', () => {
    const enemy = { id: 'test-guard', position: { x: 1, z: 1 }, radius: enemyRadius };
    expect(collidesWithEnemies({ x: 2.4, z: 1 }, [enemy], playerRadius)).toBeNull();
  });
});
