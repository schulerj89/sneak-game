import type { PickupAudioDebug } from './pickupDiagnostics';
import type { GameSettings } from './types';
import ghostStepsUrl from '../assets/ghost-steps.mp3?url';
import cyberpunkMoonlightUrl from '../assets/cyberpunk-moonlight-sonata.mp3?url';
import darkSciFiSectorUrl from '../assets/dark-sci-fi-sector.mp3?url';
import darkSciFiPulseUrl from '../assets/dark-sci-fi-pulse.mp3?url';
import darkSciFiUrgentUrl from '../assets/dark-sci-fi-urgent.mp3?url';

export const soundtrackOptions = [
  {
    id: 'ghost-steps',
    name: 'Ghost Steps',
    url: ghostStepsUrl,
    tempoBpm: 122,
    source: {
      kind: 'external',
      license: 'CC-BY 4.0',
      sourceUrl: 'https://opengameart.org/content/ghost-steps-davidkbd-vs-tsorthan-grove',
      attribution:
        '"Ghost Steps" from "Code Injection Dark Techno Music Pack" by DavidKBD. License: CC BY 4.0. Includes tracks by Tsorthan Grove: "Morbid technology" and "Dark Ambient Drone #2", CC-BY 4.0.',
    },
  },
  {
    id: 'cyberpunk-moonlight',
    name: 'Cyberpunk Moonlight',
    url: cyberpunkMoonlightUrl,
    tempoBpm: 108,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/cyberpunk-moonlight-sonata',
      attribution: '"Cyberpunk Moonlight Sonata v2" by Joth. License: CC0. Attribution appreciated, but not required.',
    },
  },
  {
    id: 'dark-sci-fi-sector',
    name: 'Dark Sci-Fi: Sector',
    url: darkSciFiSectorUrl,
    tempoBpm: 88,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
      attribution:
        '"Sector" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required.',
    },
  },
  {
    id: 'dark-sci-fi-pulse',
    name: 'Dark Sci-Fi: Pulse',
    url: darkSciFiPulseUrl,
    tempoBpm: 104,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
      attribution:
        '"Pulse" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required.',
    },
  },
  {
    id: 'dark-sci-fi-urgent',
    name: 'Dark Sci-Fi: Urgent',
    url: darkSciFiUrgentUrl,
    tempoBpm: 124,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
      attribution:
        '"Urgent" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required.',
    },
  },
] as const;

export class MusicDirector {
  private readonly audio = new Audio();
  private effectContext: AudioContext | null = null;
  private pickupSamples: Float32Array | null = null;
  private pickupBuffer: AudioBuffer | null = null;
  private effectsPrimed = false;
  private activeTrackId: GameSettings['soundtrackId'] | null = null;

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
  }

  preload(settings: GameSettings): void {
    this.preloadPickupCue();
    const track = soundtrackOptions.find((option) => option.id === settings.soundtrackId) ?? soundtrackOptions[0];
    if (this.activeTrackId !== track.id) {
      this.audio.pause();
      this.audio.src = track.url;
      this.audio.currentTime = 0;
      this.activeTrackId = track.id;
    }
    this.audio.load();
  }

  preloadPickupCue(): void {
    this.preparePickupSamples();
  }

  async sync(settings: GameSettings): Promise<void> {
    const track = soundtrackOptions.find((option) => option.id === settings.soundtrackId) ?? soundtrackOptions[0];
    if (this.activeTrackId !== track.id) {
      this.audio.pause();
      this.audio.src = track.url;
      this.audio.currentTime = 0;
      this.activeTrackId = track.id;
      this.audio.load();
    }

    if (!settings.musicEnabled) {
      this.audio.pause();
      return;
    }

    this.audio.volume = Math.min(1, settings.masterVolume * 0.86);
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

  warmupEffects(settings: GameSettings): void {
    if (!settings.musicEnabled || settings.masterVolume <= 0 || this.effectContext) return;

    this.effectContext = new AudioContext();
    this.pickupBuffer = this.createPickupBuffer(this.effectContext);
    void this.effectContext.resume().then(() => {
      if (this.effectContext) {
        this.primePickupGraph(this.effectContext);
      }
    });
  }

  playPickup(settings: GameSettings): PickupAudioDebug {
    const startedAt = performance.now();
    if (!settings.musicEnabled || settings.masterVolume <= 0) {
      return {
        status: 'muted',
        setupMs: performance.now() - startedAt,
        contextState: this.effectContext?.state ?? 'none',
        samplesReady: this.pickupSamples !== null,
        bufferReady: this.pickupBuffer !== null,
        bufferCreated: false,
        effectsPrimed: this.effectsPrimed,
        gain: 0,
      };
    }

    const context = this.effectContext ?? new AudioContext();
    this.effectContext = context;
    void context.resume().catch((error: unknown) => {
      console.warn(`[audio] pickup resume deferred ${error instanceof Error ? error.message : String(error)}`);
    });
    const bufferCreated = this.pickupBuffer === null;
    const buffer = this.pickupBuffer ?? this.createPickupBuffer(context);
    this.pickupBuffer = buffer;

    const now = context.currentTime;
    const gainLevel = Math.max(0.0001, Math.min(0.55, settings.masterVolume * 0.9));
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(context.destination);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(now);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    console.info('[audio] pickup chime');
    return {
      status: 'played',
      setupMs: performance.now() - startedAt,
      contextState: context.state,
      samplesReady: this.pickupSamples !== null,
      bufferReady: this.pickupBuffer !== null,
      bufferCreated,
      effectsPrimed: this.effectsPrimed,
      gain: gainLevel,
    };
  }

  currentTrack(): GameSettings['soundtrackId'] | null {
    return this.activeTrackId;
  }

  playbackState(): {
    activeTrackId: GameSettings['soundtrackId'] | null;
    paused: boolean;
    readyState: number;
    errorCode: number | null;
    volume: number;
  } {
    return {
      activeTrackId: this.activeTrackId,
      paused: this.audio.paused,
      readyState: this.audio.readyState,
      errorCode: this.audio.error?.code ?? null,
      volume: this.audio.volume,
    };
  }

  private preparePickupSamples(): Float32Array {
    if (this.pickupSamples) return this.pickupSamples;

    const sampleRate = 44_100;
    const duration = 0.24;
    const data = new Float32Array(Math.ceil(sampleRate * duration));
    const tau = Math.PI * 2;

    for (let index = 0; index < data.length; index += 1) {
      const time = index / sampleRate;
      const attack = Math.min(1, time / 0.015);
      const release = Math.max(0, 1 - time / 0.22);
      const envelope = attack * release * release;
      const sweepProgress = Math.min(1, time / 0.08);
      const sweepFrequency = 660 * Math.pow(990 / 660, sweepProgress);
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(tau * sweepFrequency * time));
      const upper = time >= 0.06 && time <= 0.2 ? Math.sin(tau * 1320 * (time - 0.06)) * 0.58 : 0;
      data[index] = (triangle * 0.72 + upper) * envelope;
    }

    this.pickupSamples = data;
    return data;
  }

  private createPickupBuffer(context: AudioContext): AudioBuffer {
    const samples = this.preparePickupSamples();
    const buffer = context.createBuffer(1, samples.length, 44_100);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  private primePickupGraph(context: AudioContext): void {
    if (this.effectsPrimed) return;

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.pickupBuffer ?? this.createPickupBuffer(context);
    gain.gain.value = 0.0001;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    source.stop(context.currentTime + 0.01);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    this.effectsPrimed = true;
  }
}
