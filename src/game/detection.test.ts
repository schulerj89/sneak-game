import { describe, expect, it } from 'vitest';
import { advanceSuspicion, emptySuspicion, getDetectionState, isInsideVisionCone, isSightBlocked } from './detection';
import { levels } from './levels';

describe('guard detection', () => {
  it('detects a player inside the facing cone', () => {
    expect(
      isInsideVisionCone(
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 0.2, z: 2 },
        { visionAngleDegrees: 60, visionRange: 3 },
      ),
    ).toBe(true);
  });

  it('does not detect a player behind the guard', () => {
    expect(
      isInsideVisionCone(
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 0, z: -1 },
        { visionAngleDegrees: 90, visionRange: 3 },
      ),
    ).toBe(false);
  });

  it('blocks sight through level cover', () => {
    const level = levels[0];
    expect(isSightBlocked(level, { x: -4.2, z: -0.7 }, { x: -2.1, z: -0.7 })).toBe(true);
  });

  it('reports the blocking ray state when cover hides the player', () => {
    const level = levels[0];
    const enemy = level.enemies[0];
    const state = getDetectionState(level, enemy, { x: -4.4, z: -0.7 }, { x: 1, z: 0 }, { x: -2.2, z: -0.7 });
    expect(state.spotted).toBe(false);
    expect(state.rayBlocked).toBe(true);
  });

  it('builds suspicion before detection and keeps the active enemy', () => {
    const spotted = { spotted: true, enemyId: 'guard-a', rayBlocked: false, distance: 1.2 };
    const first = advanceSuspicion(emptySuspicion(), spotted, 0.45, 'standard');
    const second = advanceSuspicion(first, spotted, 0.55, 'standard');

    expect(first.status).toBe('suspicious');
    expect(first.enemyId).toBe('guard-a');
    expect(second.status).toBe('detected');
    expect(second.value).toBe(1);
  });

  it('decays suspicion during recovery', () => {
    const suspicious = { value: 0.5, status: 'suspicious' as const, enemyId: 'guard-a' };
    const clear = { spotted: false, enemyId: null, rayBlocked: false, distance: 4 };
    const recovered = advanceSuspicion(suspicious, clear, 1, 'standard');

    expect(recovered.value).toBeLessThan(suspicious.value);
    expect(recovered.status).toBe('hidden');
    expect(recovered.enemyId).toBe(null);
  });
});
