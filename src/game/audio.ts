import type { PickupAudioDebug } from './pickupDiagnostics';
import type { GameSettings } from './types';
import ghostStepsUrl from '../assets/ghost-steps.mp3?url';
import cyberpunkMoonlightUrl from '../assets/cyberpunk-moonlight-sonata.mp3?url';
import darkSciFiSectorUrl from '../assets/dark-sci-fi-sector.mp3?url';
import darkSciFiAiryUrl from '../assets/dark-sci-fi-airy.mp3?url';
import darkSciFiPulseUrl from '../assets/dark-sci-fi-pulse.mp3?url';
import darkSciFiUrgentUrl from '../assets/dark-sci-fi-urgent.mp3?url';
import darkSciFiTransmissionUrl from '../assets/dark-sci-fi-transmission.mp3?url';
import insistentUrl from '../assets/insistent.ogg?url';
import futureLoadingLoopUrl from '../assets/future-loading-loop.wav?url';
import lostSignalUrl from '../assets/lost-signal-main-theme.mp3?url';
import backgroundSpaceUrl from '../assets/background-space-track.ogg?url';
import ambientHorrorUrl from '../assets/ambient-horror-track-01.ogg?url';
import titleOnPatrolUrl from '../assets/title-on-patrol.ogg?url';

export const titleMusicTrack = {
  id: 'title-on-patrol',
  name: 'On Patrol',
  url: titleOnPatrolUrl,
  tempoBpm: 116,
  source: {
    kind: 'external',
    license: 'CC0',
    sourceUrl: 'https://opengameart.org/content/on-patrol',
    attribution: '"On Patrol" by Section 31. License: CC0. Attribution is not required.',
  },
} as const;

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
    id: 'dark-sci-fi-airy',
    name: 'Dark Sci-Fi: Airy',
    url: darkSciFiAiryUrl,
    tempoBpm: 76,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
      attribution:
        '"Airy" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required.',
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
  {
    id: 'dark-sci-fi-transmission',
    name: 'Dark Sci-Fi: Transmission',
    url: darkSciFiTransmissionUrl,
    tempoBpm: 96,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
      attribution:
        '"Transmission" from "Ball Logic: Dark Sci-Fi Audio Pack" by SRG774. License: CC0. Attribution is appreciated, but not required.',
    },
  },
  {
    id: 'insistent',
    name: 'Insistent',
    url: insistentUrl,
    tempoBpm: 92,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/insistent-background-loop',
      attribution: '"Insistent" by yd. License: CC0. Attribution is not required.',
    },
  },
  {
    id: 'future-loading-loop',
    name: 'Future Loading Loop',
    url: futureLoadingLoopUrl,
    tempoBpm: 118,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/loading-screen-loop',
      attribution: '"Loading screen loop" by Brandon Morris, submitted by HaelDB. License: CC0. Attribution is not required.',
    },
  },
  {
    id: 'lost-signal',
    name: 'Lost Signal',
    url: lostSignalUrl,
    tempoBpm: 92,
    source: {
      kind: 'external',
      license: 'CC-BY 3.0',
      sourceUrl: 'https://opengameart.org/content/sci-fi-electronic-lost-signal',
      attribution: '"Sci-Fi electronic [lost signal]" by PetterTheSturgeon. License: CC BY 3.0.',
    },
  },
  {
    id: 'background-space',
    name: 'Background Space',
    url: backgroundSpaceUrl,
    tempoBpm: 84,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/background-space-track',
      attribution: '"Background space track" by yd. License: CC0. Attribution is not required.',
    },
  },
  {
    id: 'ambient-horror',
    name: 'Ambient Horror 01',
    url: ambientHorrorUrl,
    tempoBpm: 74,
    source: {
      kind: 'external',
      license: 'CC0',
      sourceUrl: 'https://opengameart.org/content/ambient-horror-track-01',
      attribution: '"Ambient Horror Track 01" by Cleyton Kauffman. License: CC0. Attribution is not required.',
    },
  },
] as const;

export type ActiveTrackId = GameSettings['soundtrackId'] | typeof titleMusicTrack.id;

export const levelSoundtrackIds: readonly GameSettings['soundtrackId'][] = [
  'ghost-steps',
  'dark-sci-fi-sector',
  'dark-sci-fi-airy',
  'cyberpunk-moonlight',
  'dark-sci-fi-pulse',
  'insistent',
  'background-space',
  'lost-signal',
  'dark-sci-fi-urgent',
  'ambient-horror',
  'future-loading-loop',
  'dark-sci-fi-transmission',
] as const;

export function soundtrackIdForLevel(levelIndex: number): GameSettings['soundtrackId'] {
  return levelSoundtrackIds[levelIndex % levelSoundtrackIds.length] ?? soundtrackOptions[0].id;
}

export class MusicDirector {
  private readonly audio = new Audio();
  private effectContext: AudioContext | null = null;
  private pickupGain: GainNode | null = null;
  private pickupSamples: Float32Array | null = null;
  private pickupBuffer: AudioBuffer | null = null;
  private effectsPrimed = false;
  private activeTrackId: ActiveTrackId | null = null;

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
  }

  preload(settings: GameSettings, soundtrackId: GameSettings['soundtrackId'] = settings.soundtrackId): void {
    this.preloadPickupCue();
    const track = selectedSoundtrack(soundtrackId);
    this.setTrack(track);
    this.audio.load();
  }

  preloadMenuTrack(): void {
    this.setTrack(titleMusicTrack);
    this.audio.load();
  }

  preloadPickupCue(): void {
    this.preparePickupSamples();
  }

  async sync(settings: GameSettings, soundtrackId: GameSettings['soundtrackId'] = settings.soundtrackId): Promise<void> {
    const track = selectedSoundtrack(soundtrackId);
    await this.playTrack(track, settings, 0.86, 'soundtrack');
  }

  async playMenu(settings: GameSettings): Promise<void> {
    await this.playTrack(titleMusicTrack, settings, 0.72, 'menu music');
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  async warmupEffects(settings: GameSettings): Promise<void> {
    if (settings.masterVolume <= 0) return;

    const context = this.effectContext ?? new AudioContext();
    this.effectContext = context;
    this.pickupBuffer ??= this.createPickupBuffer(context);
    this.pickupGain ??= this.createPickupGain(context);

    try {
      await withTimeout(context.resume(), 180);
      if (context.state === 'running') {
        await withTimeout(this.primePickupGraph(context), 140);
      }
    } catch (error) {
      console.warn(`[audio] pickup warmup deferred ${error instanceof Error ? error.message : String(error)}`);
    }
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
    const gain = this.pickupGain ?? this.createPickupGain(context);
    this.pickupGain = gain;

    const now = context.currentTime;
    const gainLevel = Math.max(0.0001, Math.min(0.55, settings.masterVolume * 0.9));
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(now);
    this.effectsPrimed = true;
    source.addEventListener('ended', () => {
      source.disconnect();
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

  currentTrack(): ActiveTrackId | null {
    return this.activeTrackId;
  }

  playbackState(): {
    activeTrackId: ActiveTrackId | null;
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

  private async playTrack(
    track: (typeof soundtrackOptions)[number] | typeof titleMusicTrack,
    settings: GameSettings,
    volumeScale: number,
    logLabel: string,
  ): Promise<void> {
    this.setTrack(track);
    if (!settings.musicEnabled) {
      this.audio.pause();
      return;
    }

    this.audio.volume = Math.min(1, settings.masterVolume * volumeScale);
    try {
      await this.audio.play();
      console.info(`[audio] ${logLabel} playing ${track.name}`);
    } catch (error) {
      console.warn(`[audio] playback deferred ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setTrack(track: (typeof soundtrackOptions)[number] | typeof titleMusicTrack): void {
    if (this.activeTrackId === track.id) return;

    this.audio.pause();
    this.audio.src = track.url;
    this.audio.currentTime = 0;
    this.activeTrackId = track.id;
    this.audio.load();
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

  private createPickupGain(context: AudioContext): GainNode {
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    gain.connect(context.destination);
    return gain;
  }

  private primePickupGraph(context: AudioContext): Promise<void> {
    if (this.effectsPrimed) return Promise.resolve();

    const source = context.createBufferSource();
    const gain = this.pickupGain ?? this.createPickupGain(context);
    this.pickupGain = gain;
    source.buffer = this.pickupBuffer ?? this.createPickupBuffer(context);
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    source.connect(gain);
    this.effectsPrimed = true;
    return new Promise((resolve) => {
      source.addEventListener('ended', () => {
        source.disconnect();
        resolve();
      }, { once: true });
      source.start(now);
      source.stop(now + 0.02);
    });
  }
}

function selectedSoundtrack(soundtrackId: GameSettings['soundtrackId']): (typeof soundtrackOptions)[number] {
  return soundtrackOptions.find((option) => option.id === soundtrackId) ?? soundtrackOptions[0];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => resolve(), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}
