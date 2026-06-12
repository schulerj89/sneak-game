import type { GameSettings } from './types';
import themeUrl from '../assets/shadow-circuit-theme.wav?url';
import pulseRunnerUrl from '../assets/pulse-runner.wav?url';
import deepCoverUrl from '../assets/deep-cover.wav?url';

export const soundtrackOptions = [
  { id: 'shadow-circuit', name: 'Shadow Circuit', url: themeUrl },
  { id: 'pulse-runner', name: 'Pulse Runner', url: pulseRunnerUrl },
  { id: 'deep-cover', name: 'Deep Cover', url: deepCoverUrl },
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
    await this.audio.play();
    console.info(`[audio] soundtrack playing ${track.name}`);
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}
