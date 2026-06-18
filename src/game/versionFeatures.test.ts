import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  firstRunCinematicTutorialFeature,
  markVersionedFeatureSeen,
  shouldShowVersionedFeature,
  versionedFeaturesStorageKey,
} from './versionFeatures';

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

describe('versioned feature visibility', () => {
  it('compares semantic version numbers', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBe(1);
    expect(compareVersions('2.9.0', '2.9.0')).toBe(0);
    expect(compareVersions('2.8.9', '2.9.0')).toBe(-1);
  });

  it('shows a feature once per introduced version', () => {
    const storage = new MemoryStorage();

    expect(shouldShowVersionedFeature(firstRunCinematicTutorialFeature, storage, firstRunCinematicTutorialFeature.introducedVersion)).toBe(true);
    markVersionedFeatureSeen(firstRunCinematicTutorialFeature, storage);
    expect(shouldShowVersionedFeature(firstRunCinematicTutorialFeature, storage, firstRunCinematicTutorialFeature.introducedVersion)).toBe(false);

    const stored = JSON.parse(storage.getItem(versionedFeaturesStorageKey) ?? '{}') as Record<string, string>;
    expect(stored['first-run-cinematic-tutorial']).toBe(firstRunCinematicTutorialFeature.introducedVersion);
  });

  it('does not show a feature before its introduced version', () => {
    const storage = new MemoryStorage();

    expect(shouldShowVersionedFeature(firstRunCinematicTutorialFeature, storage, '0.0.0')).toBe(false);
  });
});
