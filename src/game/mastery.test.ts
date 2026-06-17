import { describe, expect, it } from 'vitest';
import { recordLevelAchievementClear } from './achievements';
import { buildLevelMasteryProgress, loadLevelMasteryProgress, retryTargetForCompletion } from './mastery';
import { createRunSummary, saveBestTime } from './runStats';
import type { LevelDefinition } from './types';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ReadBlockedStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
}

const baseLevel: LevelDefinition = {
  id: 'dock-blackout',
  name: 'Dock Blackout',
  briefing: 'Slip through the dock.',
  parSeconds: 35,
  floorSize: { x: 12, z: 8 },
  start: { x: -5, z: 0 },
  goal: { x: 5, z: 0 },
  goalRadius: 0.8,
  obstacles: [],
  lights: [],
  enemies: [],
  validationRoute: [],
};

const secondLevel: LevelDefinition = {
  ...baseLevel,
  id: 'archive-lanes',
  name: 'Archive Lanes',
  parSeconds: 40,
};

const levels = [baseLevel, secondLevel] as const;
const levelIds = levels.map((level) => level.id);

describe('mastery progress', () => {
  it('starts every level with locked mastery marks and a clear target', () => {
    const mastery = loadLevelMasteryProgress(levels, new MemoryStorage());

    expect(mastery).toHaveLength(2);
    expect(mastery[0]).toMatchObject({
      levelId: 'dock-blackout',
      clears: 0,
      bestGrade: null,
      bestTimeMs: null,
      completedMarks: 0,
      totalMarks: 4,
      nextTarget: 'Clear the route',
    });
    expect(mastery[0].marks.map((mark) => [mark.label, mark.complete])).toEqual([
      ['Clear', false],
      ['S', false],
      ['Par', false],
      ['2x', false],
    ]);
  });

  it('merges achievement clears, best grades, and best times into level marks', () => {
    const storage = new MemoryStorage();

    recordLevelAchievementClear({ levelId: baseLevel.id, grade: 'S', levelIds, storage });
    saveBestTime(baseLevel.id, 31_500, storage);

    const [mastery] = loadLevelMasteryProgress(levels, storage);

    expect(mastery.clears).toBe(1);
    expect(mastery.bestGrade).toBe('S');
    expect(mastery.bestTimeMs).toBe(31_500);
    expect(mastery.completedMarks).toBe(3);
    expect(mastery.marks.map((mark) => [mark.id, mark.complete])).toEqual([
      ['clear', true],
      ['s-rank', true],
      ['par-time', true],
      ['second-clear', false],
    ]);
    expect(mastery.nextTarget).toBe('Second clear ready');
  });

  it('falls back to empty mastery when storage reads are blocked', () => {
    const mastery = loadLevelMasteryProgress(levels, new ReadBlockedStorage());

    expect(mastery.map((level) => level.completedMarks)).toEqual([0, 0]);
    expect(mastery.map((level) => level.nextTarget)).toEqual(['Clear the route', 'Clear the route']);
  });

  it('chooses a retry prompt for the next best replay target', () => {
    const aSummary = createRunSummary({
      elapsedMs: 35_000,
      parSeconds: 35,
      alerts: 1,
      previousBestTimeMs: null,
    });
    expect(retryTargetForCompletion(baseLevel, aSummary, buildLevelMasteryProgress(baseLevel, 1, 'A', 35_000)).label).toBe(
      'Retry for S',
    );

    const firstSSummary = createRunSummary({
      elapsedMs: 30_000,
      parSeconds: 35,
      alerts: 0,
      previousBestTimeMs: null,
    });
    expect(retryTargetForCompletion(baseLevel, firstSSummary, buildLevelMasteryProgress(baseLevel, 1, 'S', 30_000)).label).toBe(
      'Second clear ready',
    );

    const masteredSummary = createRunSummary({
      elapsedMs: 32_000,
      parSeconds: 35,
      alerts: 0,
      previousBestTimeMs: 30_000,
    });
    expect(
      retryTargetForCompletion(baseLevel, masteredSummary, buildLevelMasteryProgress(baseLevel, 2, 'S', 30_000)).label,
    ).toBe('Beat best 0:30');
  });
});
