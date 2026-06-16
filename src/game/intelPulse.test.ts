import { describe, expect, it } from 'vitest';
import { createIntelPulsePlan } from './intelPulse';
import { levels } from './levels';

describe('createIntelPulsePlan', () => {
  it('targets only remaining objectives plus the exit', () => {
    const level = levels[0];
    const collected = new Set([level.objectives?.[0]?.id ?? '']);
    const plan = createIntelPulsePlan(level, collected, { includePatrols: false });

    expect(plan.exitMarker.position).toEqual(level.goal);
    expect(plan.exitMarker.radius).toBe(level.goalRadius);
    expect(plan.objectiveMarkers).toHaveLength((level.objectives?.length ?? 0) - 1);
    expect(plan.objectiveMarkers.some((marker) => collected.has(marker.id))).toBe(false);
    expect(plan.patrolRoutes).toHaveLength(0);
    expect(plan.waypointCount).toBe(0);
  });

  it('can include enemy patrol routes without duplicating the start point', () => {
    const level = levels.find((candidate) => candidate.enemies.length > 0);
    expect(level).toBeDefined();
    if (!level) return;

    const plan = createIntelPulsePlan(level, new Set(), { includePatrols: true });
    const firstEnemy = level.enemies[0];
    const firstRoute = plan.patrolRoutes.find((route) => route.enemyId === firstEnemy.id);

    expect(plan.patrolRoutes).toHaveLength(level.enemies.length);
    expect(firstRoute?.points[0]).toEqual(firstEnemy.start);
    expect(firstRoute?.points[1]).not.toEqual(firstEnemy.start);
    expect(plan.waypointCount).toBeGreaterThanOrEqual(plan.patrolRoutes.length * 2);
  });
});
