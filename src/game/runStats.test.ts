import { describe, expect, it } from 'vitest';
import { createRunSummary, loadBestTime, saveBestTime } from './runStats';

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

class WriteBlockedStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('blocked');
  }
}

describe('run stats', () => {
  it('awards an S grade for a clean par run', () => {
    const summary = createRunSummary({
      elapsedMs: 29_500,
      parSeconds: 35,
      alerts: 0,
      previousBestTimeMs: null,
    });

    expect(summary.grade).toBe('S');
    expect(summary.score).toBe(1000);
    expect(summary.isNewBest).toBe(true);
  });

  it('penalizes alerts and overtime', () => {
    const summary = createRunSummary({
      elapsedMs: 50_000,
      parSeconds: 35,
      alerts: 2,
      previousBestTimeMs: 45_000,
    });

    expect(summary.grade).toBe('C');
    expect(summary.score).toBe(600);
    expect(summary.isNewBest).toBe(false);
  });

  it('loads and saves best times per level', () => {
    const storage = new MemoryStorage();

    expect(loadBestTime('dock-blackout', storage)).toBe(null);
    saveBestTime('dock-blackout', 31_234.4, storage);

    expect(loadBestTime('dock-blackout', storage)).toBe(31_234);
    expect(loadBestTime('archive-lanes', storage)).toBe(null);
  });

  it('does not interrupt completion when storage writes are blocked', () => {
    const storage = new WriteBlockedStorage();

    expect(() => saveBestTime('dock-blackout', 31_234.4, storage)).not.toThrow();
    expect(loadBestTime('dock-blackout', storage)).toBe(null);
  });
});
