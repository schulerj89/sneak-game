import { describe, expect, it } from 'vitest';
import { loadAchievementProgress, recordLevelAchievementClear } from './achievements';

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

const levelIds = ['dock-blackout', 'archive-lanes', 'reactor-core'] as const;

describe('achievements', () => {
  it('tracks completion progress and unlocks when every level is cleared', () => {
    const storage = new MemoryStorage();

    let result = recordLevelAchievementClear({ levelId: levelIds[0], grade: 'A', levelIds, storage });
    expect(result.progress.find((achievement) => achievement.id === 'complete-all-levels')?.progress).toBe(1);
    expect(result.unlocked).toHaveLength(0);

    recordLevelAchievementClear({ levelId: levelIds[1], grade: 'B', levelIds, storage });
    result = recordLevelAchievementClear({ levelId: levelIds[2], grade: 'C', levelIds, storage });

    expect(result.unlocked.map((achievement) => achievement.id)).toContain('complete-all-levels');
    expect(loadAchievementProgress(levelIds, storage).find((achievement) => achievement.id === 'complete-all-levels')?.unlocked).toBe(true);
  });

  it('keeps the best grade for S-rank progress', () => {
    const storage = new MemoryStorage();

    for (const levelId of levelIds) {
      recordLevelAchievementClear({ levelId, grade: 'A', levelIds, storage });
    }

    let progress = loadAchievementProgress(levelIds, storage).find((achievement) => achievement.id === 's-rank-all-levels');
    expect(progress?.progress).toBe(0);

    recordLevelAchievementClear({ levelId: levelIds[0], grade: 'S', levelIds, storage });
    recordLevelAchievementClear({ levelId: levelIds[1], grade: 'S', levelIds, storage });
    const result = recordLevelAchievementClear({ levelId: levelIds[2], grade: 'S', levelIds, storage });
    progress = result.progress.find((achievement) => achievement.id === 's-rank-all-levels');

    expect(progress?.progress).toBe(3);
    expect(result.unlocked.map((achievement) => achievement.id)).toContain('s-rank-all-levels');
  });

  it('requires two clears per level for the second sweep achievement', () => {
    const storage = new MemoryStorage();

    for (const levelId of levelIds) {
      recordLevelAchievementClear({ levelId, grade: 'S', levelIds, storage });
    }

    let progress = loadAchievementProgress(levelIds, storage).find((achievement) => achievement.id === 'clear-all-levels-twice');
    expect(progress?.progress).toBe(3);
    expect(progress?.target).toBe(6);

    recordLevelAchievementClear({ levelId: levelIds[0], grade: 'S', levelIds, storage });
    recordLevelAchievementClear({ levelId: levelIds[1], grade: 'S', levelIds, storage });
    const result = recordLevelAchievementClear({ levelId: levelIds[2], grade: 'S', levelIds, storage });
    progress = result.progress.find((achievement) => achievement.id === 'clear-all-levels-twice');

    expect(progress?.progress).toBe(6);
    expect(result.unlocked.map((achievement) => achievement.id)).toContain('clear-all-levels-twice');
  });
});
