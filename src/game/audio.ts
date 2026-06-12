import type { GameSettings } from './types';

export class MusicDirector {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];

  async sync(settings: GameSettings): Promise<void> {
    if (!settings.musicEnabled) {
      this.stop();
      return;
    }

    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
      this.createLoop();
      console.info('[audio] Shadow Circuit music loop armed');
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    if (this.gain) {
      this.gain.gain.setTargetAtTime(settings.masterVolume * 0.18, this.context.currentTime, 0.05);
    }
  }

  stop(): void {
    for (const oscillator of this.oscillators) {
      oscillator.stop();
      oscillator.disconnect();
    }
    this.oscillators = [];
    this.context?.close();
    this.context = null;
    this.gain = null;
  }

  private createLoop(): void {
    if (!this.context || !this.gain) return;

    const now = this.context.currentTime;
    const notes = [55, 82.41, 110, 164.81];
    for (const [index, frequency] of notes.entries()) {
      const oscillator = this.context.createOscillator();
      const noteGain = this.context.createGain();
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      noteGain.gain.setValueAtTime(index === 0 ? 0.9 : 0.24, now);
      oscillator.connect(noteGain).connect(this.gain);
      oscillator.start(now + index * 0.04);
      this.oscillators.push(oscillator);
    }
  }
}
