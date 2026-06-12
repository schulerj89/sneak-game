import type { GameSettings } from './types';
import themeUrl from '../assets/shadow-circuit-theme.wav?url';

export class MusicDirector {
  private readonly audio = new Audio(themeUrl);

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
  }

  async sync(settings: GameSettings): Promise<void> {
    if (!settings.musicEnabled) {
      this.audio.pause();
      return;
    }

    this.audio.volume = settings.masterVolume * 0.62;
    await this.audio.play();
    console.info('[audio] Shadow Circuit custom theme playing');
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}
