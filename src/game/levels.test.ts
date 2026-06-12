import { describe, expect, it } from 'vitest';
import { levels } from './levels';
import { pointInRect, segmentIntersectsRect } from './math';

describe('level definitions', () => {
  it('ships the requested first three levels', () => {
    expect(levels).toHaveLength(3);
    expect(levels.map((level) => level.id)).toEqual(['dock-blackout', 'archive-lanes', 'reactor-core']);
  });

  it('keeps starts, goals, and validation routes out of hard cover', () => {
    for (const level of levels) {
      const points = [level.start, level.goal, ...level.validationRoute];
      for (const point of points) {
        expect.soft(Math.abs(point.x)).toBeLessThanOrEqual(level.floorSize.x / 2);
        expect.soft(Math.abs(point.z)).toBeLessThanOrEqual(level.floorSize.z / 2);
        expect.soft(level.obstacles.some((obstacle) => pointInRect(point, obstacle, 0.2))).toBe(false);
      }
    }
  });

  it('keeps validation route segments from crossing obstacle interiors', () => {
    for (const level of levels) {
      for (let index = 1; index < level.validationRoute.length; index += 1) {
        const previous = level.validationRoute[index - 1];
        const current = level.validationRoute[index];
        const blocked = level.obstacles.some((obstacle) => segmentIntersectsRect(previous, current, obstacle, 0.18));
        expect.soft(blocked, `${level.id} route segment ${index}`).toBe(false);
      }
    }
  });
});
