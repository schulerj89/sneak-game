export type PickupAudioDebug = Readonly<{
  status: 'idle' | 'muted' | 'played' | 'error';
  setupMs: number;
  contextState: string;
  samplesReady: boolean;
  bufferReady: boolean;
  bufferCreated: boolean;
  effectsPrimed: boolean;
  gain: number;
}>;

export type PickupDebugSample = Readonly<{
  id: string | null;
  label: string;
  collectedAtMs: number | null;
  totalMs: number;
  collectMs: number;
  meshMs: number;
  audioMs: number;
  uiMs: number;
  frameSpikeMs: number;
  framesObserved: number;
  audio: PickupAudioDebug;
}>;

export type PickupFrameProbe = Readonly<{
  collectedAtMs: number;
  maxFrameMs: number;
  framesObserved: number;
}>;

export type PickupDebugInput = Readonly<{
  id: string | null;
  label: string;
  collectedAtMs: number;
  totalMs: number;
  collectMs: number;
  meshMs: number;
  audioMs: number;
  uiMs: number;
  audio: PickupAudioDebug;
}>;

export function emptyPickupDebugSample(): PickupDebugSample {
  return {
    id: null,
    label: 'none',
    collectedAtMs: null,
    totalMs: 0,
    collectMs: 0,
    meshMs: 0,
    audioMs: 0,
    uiMs: 0,
    frameSpikeMs: 0,
    framesObserved: 0,
    audio: {
      status: 'idle',
      setupMs: 0,
      contextState: 'none',
      samplesReady: false,
      bufferReady: false,
      bufferCreated: false,
      effectsPrimed: false,
      gain: 0,
    },
  };
}

export function createPickupDebugSample(input: PickupDebugInput): PickupDebugSample {
  return {
    ...input,
    frameSpikeMs: 0,
    framesObserved: 0,
  };
}

export function beginPickupFrameProbe(collectedAtMs: number): PickupFrameProbe {
  return { collectedAtMs, maxFrameMs: 0, framesObserved: 0 };
}

export function updatePickupFrameProbe(
  debug: PickupDebugSample,
  probe: PickupFrameProbe | null,
  frameMs: number,
  now: number,
): { debug: PickupDebugSample; probe: PickupFrameProbe | null } {
  if (!probe || now - probe.collectedAtMs < 8) {
    return { debug, probe };
  }

  const framesObserved = probe.framesObserved + 1;
  const maxFrameMs = Math.max(probe.maxFrameMs, frameMs);
  const nextProbe = { ...probe, framesObserved, maxFrameMs };
  const nextDebug = {
    ...debug,
    frameSpikeMs: maxFrameMs,
    framesObserved,
  };

  return {
    debug: nextDebug,
    probe: framesObserved >= 12 || now - probe.collectedAtMs > 500 ? null : nextProbe,
  };
}
