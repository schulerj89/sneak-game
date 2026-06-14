import type { DetectionLeniency, GameSettings, RenderQuality, SoundtrackId } from './types';

const storageKey = 'shadow-circuit-settings-v2';
export const memoryCapMb = 224;
export const targetFps = 60;

export const defaultSettings: GameSettings = {
  quality: 'cinematic',
  musicEnabled: true,
  debugEnabled: true,
  masterVolume: 0.36,
  soundtrackId: 'ghost-steps',
  detectionLeniency: 'standard',
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
      soundtrackId: isSoundtrackId(parsed.soundtrackId) ? parsed.soundtrackId : defaultSettings.soundtrackId,
      detectionLeniency: isDetectionLeniency(parsed.detectionLeniency)
        ? parsed.detectionLeniency
        : defaultSettings.detectionLeniency,
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
  shadowMapSize: number;
  memoryReserveMb: number;
} {
  if (quality === 'cinematic') {
    return { pixelRatio: Math.min(window.devicePixelRatio, 1.9), antialias: true, shadows: true, debugRayCount: 18, shadowMapSize: 2048, memoryReserveMb: 64 };
  }

  if (quality === 'balanced') {
    return { pixelRatio: Math.min(window.devicePixelRatio, 1.35), antialias: true, shadows: true, debugRayCount: 10, shadowMapSize: 1024, memoryReserveMb: 0 };
  }

  return { pixelRatio: 1, antialias: false, shadows: false, debugRayCount: 6, shadowMapSize: 512, memoryReserveMb: 0 };
}

function isQuality(value: unknown): value is RenderQuality {
  return value === 'memory' || value === 'balanced' || value === 'cinematic';
}

function isSoundtrackId(value: unknown): value is SoundtrackId {
  return (
    value === 'ghost-steps' ||
    value === 'cyberpunk-moonlight' ||
    value === 'dark-sci-fi-sector' ||
    value === 'dark-sci-fi-pulse' ||
    value === 'dark-sci-fi-urgent'
  );
}

function isDetectionLeniency(value: unknown): value is DetectionLeniency {
  return value === 'forgiving' || value === 'standard' || value === 'sharp';
}
