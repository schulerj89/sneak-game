import type { GameSettings } from './types';
import nightOpsUrl from '../assets/night-ops.mp3?url';
import themeUrl from '../assets/shadow-circuit-theme.wav?url';
import pulseRunnerUrl from '../assets/pulse-runner.wav?url';
import deepCoverUrl from '../assets/deep-cover.wav?url';
import metroEscapeUrl from '../assets/metro-escape.mp3?url';

export const soundtrackOptions = [
  {
    id: 'night-ops',
    name: 'Night Ops',
    url: nightOpsUrl,
    tempoBpm: 132,
    source: {
      kind: 'project-generated',
      license: 'Project-owned generated audio',
      sourceUrl: 'scripts/generate-audio.ts',
      attribution: 'Generated for Shadow Circuit by the local audio script as the smoother default stealth mix.',
    },
  },
  {
    id: 'shadow-circuit',
    name: 'Shadow Circuit',
    url: themeUrl,
    tempoBpm: 127,
    source: {
      kind: 'project-generated',
      license: 'Project-owned generated audio',
      sourceUrl: 'scripts/generate-audio.ts',
      attribution: 'Generated for Shadow Circuit by the local audio script.',
    },
  },
  {
    id: 'pulse-runner',
    name: 'Pulse Runner',
    url: pulseRunnerUrl,
    tempoBpm: 153,
    source: {
      kind: 'project-generated',
      license: 'Project-owned generated audio',
      sourceUrl: 'scripts/generate-audio.ts',
      attribution: 'Generated for Shadow Circuit by the local audio script.',
    },
  },
  {
    id: 'deep-cover',
    name: 'Deep Cover',
    url: deepCoverUrl,
    tempoBpm: 109,
    source: {
      kind: 'project-generated',
      license: 'Project-owned generated audio',
      sourceUrl: 'scripts/generate-audio.ts',
      attribution: 'Generated for Shadow Circuit by the local audio script.',
    },
  },
  {
    id: 'metro-escape',
    name: 'Metro Escape',
    url: metroEscapeUrl,
    tempoBpm: 168,
    source: {
      kind: 'project-generated',
      license: 'Project-owned generated audio',
      sourceUrl: 'scripts/generate-audio.ts',
      attribution: 'Generated for Shadow Circuit by the local audio script as the first replacement-track candidate.',
    },
  },
] as const;

export class MusicDirector {
  private readonly audio = new Audio();
  private effectContext: AudioContext | null = null;
  private activeTrackId: GameSettings['soundtrackId'] | null = null;

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'metadata';
  }

  async sync(settings: GameSettings): Promise<void> {
    const track = soundtrackOptions.find((option) => option.id === settings.soundtrackId) ?? soundtrackOptions[0];
    if (this.activeTrackId !== track.id) {
      this.audio.pause();
      this.audio.src = track.url;
      this.audio.currentTime = 0;
      this.activeTrackId = track.id;
    }

    if (!settings.musicEnabled) {
      this.audio.pause();
      return;
    }

    this.audio.volume = settings.masterVolume * 0.62;
    try {
      await this.audio.play();
      console.info(`[audio] soundtrack playing ${track.name}`);
    } catch (error) {
      console.warn(`[audio] playback deferred ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  playPickup(settings: GameSettings): void {
    if (!settings.musicEnabled || settings.masterVolume <= 0) return;

    const context = this.effectContext ?? new AudioContext();
    this.effectContext = context;
    void context.resume();

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, settings.masterVolume * 0.18), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(context.destination);

    const first = context.createOscillator();
    first.type = 'triangle';
    first.frequency.setValueAtTime(660, now);
    first.frequency.exponentialRampToValueAtTime(990, now + 0.08);
    first.connect(gain);
    first.start(now);
    first.stop(now + 0.12);

    const second = context.createOscillator();
    second.type = 'sine';
    second.frequency.setValueAtTime(1320, now + 0.06);
    second.connect(gain);
    second.start(now + 0.06);
    second.stop(now + 0.2);

    second.addEventListener('ended', () => gain.disconnect(), { once: true });
    console.info('[audio] pickup chime');
  }

  currentTrack(): GameSettings['soundtrackId'] | null {
    return this.activeTrackId;
  }
}
