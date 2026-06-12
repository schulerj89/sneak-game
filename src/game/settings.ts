import type { GameSettings, RenderQuality } from './types';

const storageKey = 'shadow-circuit-settings-v1';

export const defaultSettings: GameSettings = {
  quality: 'memory',
  musicEnabled: true,
  debugEnabled: true,
  masterVolume: 0.36,
};

export function loadSettings(): GameSettings {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return { ...defaultSettings };
    const parsed = JSON.parse(stored) as Partial<GameSettings>;
    return {
      quality: isQuality(parsed.quality) ? parsed.quality : defaultSettings.quality,
      musicEnabled: parsed.musicEnabled ?? defaultSettings.musicEnabled,
      debugEnabled: parsed.debugEnabled ?? defaultSettings.debugEnabled,
      masterVolume:
        typeof parsed.masterVolume === 'number' ? Math.min(1, Math.max(0, parsed.masterVolume)) : defaultSettings.masterVolume,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: GameSettings): void {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function qualityProfile(quality: RenderQuality): {
  pixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  debugRayCount: number;
} {
  if (quality === 'cinematic') {
    return { pixelRatio: Math.min(window.devicePixelRatio, 2), antialias: true, shadows: true, debugRayCount: 18 };
  }

  if (quality === 'balanced') {
    return { pixelRatio: Math.min(window.devicePixelRatio, 1.5), antialias: true, shadows: true, debugRayCount: 10 };
  }

  return { pixelRatio: 1, antialias: false, shadows: false, debugRayCount: 6 };
}

function isQuality(value: unknown): value is RenderQuality {
  return value === 'memory' || value === 'balanced' || value === 'cinematic';
}
