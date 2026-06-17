import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from './settings';

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

const settingsKey = 'shadow-circuit-settings-v3';

describe('settings storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to defaults for invalid stored primitive settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(settingsKey, 'false');
    vi.stubGlobal('window', { localStorage: storage });

    expect(loadSettings()).toEqual(defaultSettings);
  });

  it('ignores corrupted boolean and volume settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      settingsKey,
      JSON.stringify({
        quality: 'memory',
        musicEnabled: 'yes',
        debugEnabled: 1,
        masterVolume: Number.NaN,
        soundtrackId: 'ghost-steps',
        detectionLeniency: 'sharp',
      }),
    );
    vi.stubGlobal('window', { localStorage: storage });

    expect(loadSettings()).toMatchObject({
      quality: 'memory',
      musicEnabled: defaultSettings.musicEnabled,
      debugEnabled: defaultSettings.debugEnabled,
      masterVolume: defaultSettings.masterVolume,
      soundtrackId: 'ghost-steps',
      detectionLeniency: 'sharp',
    });
  });

  it('saves settings without throwing when storage writes are blocked', () => {
    vi.stubGlobal('window', {
      localStorage: {
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(() => saveSettings(defaultSettings)).not.toThrow();
  });
});
