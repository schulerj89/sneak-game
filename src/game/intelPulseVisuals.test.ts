import { describe, expect, it } from 'vitest';
import { levels } from './levels';
import { IntelPulseVisuals } from './intelPulseVisuals';

describe('IntelPulseVisuals', () => {
  it('batches repeated pulse markers and waypoints into instanced meshes', () => {
    const visuals = new IntelPulseVisuals();
    const level = levels[0];
    const plan = visuals.rebuild(level, new Set(), true);
    const stats = visuals.stats();

    expect(stats.meshes).toBe(0);
    expect(stats.instancedMeshes).toBeGreaterThan(0);
    expect(stats.lines).toBe(plan.patrolRoutes.length);
    expect(stats.instances).toBe((plan.objectiveMarkers.length + 1) * 3 + plan.waypointCount);

    visuals.clear();
    expect(visuals.stats()).toMatchObject({
      objects: 0,
      meshes: 0,
      instancedMeshes: 0,
      lines: 0,
      instances: 0,
    });
  });
});
