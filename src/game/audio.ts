import type { GameSettings } from './types';
import themeUrl from '../assets/shadow-circuit-theme.wav?url';
import pulseRunnerUrl from '../assets/pulse-runner.wav?url';
import deepCoverUrl from '../assets/deep-cover.wav?url';
import metroEscapeUrl from '../assets/metro-escape.mp3?url';

export const soundtrackOptions = [
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

  currentTrack(): GameSettings['soundtrackId'] | null {
    return this.activeTrackId;
  }
}
