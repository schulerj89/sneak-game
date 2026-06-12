import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

type TrackSpec = {
  file: string;
  compressedFile?: string;
  tempo: number;
  seconds: number;
  bassNotes: readonly number[];
  arpNotes: readonly number[];
  kickWeight: number;
  bassWeight: number;
  subWeight: number;
  seed: number;
};

const TAU = Math.PI * 2;
const sampleRate = 22_050;
const channels = 1;
const bitsPerSample = 16;
const execFileAsync = promisify(execFile);

const tracks: readonly TrackSpec[] = [
  {
    file: 'shadow-circuit-theme.wav',
    tempo: 2.12,
    seconds: 28,
    bassNotes: [55, 41.2, 65.41, 49, 73.42, 49, 55, 82.41],
    arpNotes: [220, 246.94, 329.63, 392, 329.63, 246.94, 196, 246.94],
    kickWeight: 0.34,
    bassWeight: 0.48,
    subWeight: 0.28,
    seed: 12_345,
  },
  {
    file: 'pulse-runner.wav',
    tempo: 2.55,
    seconds: 24,
    bassNotes: [65.41, 49, 65.41, 82.41, 73.42, 55, 49, 55],
    arpNotes: [261.63, 329.63, 392, 493.88, 392, 329.63, 246.94, 329.63],
    kickWeight: 0.38,
    bassWeight: 0.52,
    subWeight: 0.3,
    seed: 78_441,
  },
  {
    file: 'deep-cover.wav',
    tempo: 1.82,
    seconds: 32,
    bassNotes: [41.2, 41.2, 49, 36.71, 55, 49, 41.2, 65.41],
    arpNotes: [164.81, 196, 246.94, 293.66, 246.94, 196, 146.83, 196],
    kickWeight: 0.29,
    bassWeight: 0.56,
    subWeight: 0.36,
    seed: 32_019,
  },
  {
    file: 'metro-escape.wav',
    compressedFile: 'metro-escape.mp3',
    tempo: 2.8,
    seconds: 24,
    bassNotes: [73.42, 55, 73.42, 98, 82.41, 65.41, 55, 65.41],
    arpNotes: [293.66, 369.99, 440, 554.37, 440, 369.99, 277.18, 369.99],
    kickWeight: 0.46,
    bassWeight: 0.64,
    subWeight: 0.42,
    seed: 91_337,
  },
];

await mkdir('src/assets', { recursive: true });
for (const track of tracks) {
  await writeFile(`src/assets/${track.file}`, wav(renderTrack(track)));
  console.info(`[assets] wrote src/assets/${track.file}`);
  if (track.compressedFile) {
    await writeCompressedTrack(track.file, track.compressedFile);
  }
}

async function writeCompressedTrack(sourceFile: string, outputFile: string): Promise<void> {
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      `src/assets/${sourceFile}`,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      `src/assets/${outputFile}`,
    ]);
    console.info(`[assets] wrote src/assets/${outputFile}`);
  } catch (error) {
    console.warn(`[assets] skipped ${outputFile}; install ffmpeg to regenerate compressed audio`);
    if (error instanceof Error) {
      console.warn(`[assets] ${error.message}`);
    }
  }
}

function renderTrack(track: TrackSpec): Int16Array {
  const samples = sampleRate * track.seconds;
  const data = new Int16Array(samples);
  let noiseSeed = track.seed;

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const beat = time * track.tempo;
    const bass = noteAt(track.bassNotes, beat / 2);
    const arp = noteAt(track.arpNotes, beat * 2);
    const bassEnv = pulseEnvelope(beat, 0.78, 2.0);
    const subEnv = pulseEnvelope(beat, 0.88, 1.5);
    const arpEnv = pulseEnvelope(beat * 2, 0.32, 7.2);
    const kickEnv = pulseEnvelope(beat, 0.2, 13);
    const hatEnv = pulseEnvelope(beat * 4 + 0.5, 0.08, 24);

    const shimmer = Math.sin(TAU * (arp * 2.01) * time) * 0.04 * arpEnv;
    const bassTone = softSine(bass, time) * track.bassWeight * bassEnv;
    const subBass = Math.sin(TAU * (bass / 2) * time) * track.subWeight * subEnv;
    const arpTone = triangle(arp, time) * 0.15 * arpEnv;
    const kick = Math.sin(TAU * (54 - kickEnv * 24) * time) * track.kickWeight * kickEnv;
    const hat = nextNoise() * 0.07 * hatEnv;
    const roomBreath = Math.sin(TAU * 0.07 * time) * 0.05;
    const fade = edgeFade(time, track.seconds, 1.4);

    data[index] = clamp16((bassTone + subBass + arpTone + shimmer + kick + hat + roomBreath) * fade * 23_500);
  }

  return data;

  function nextNoise(): number {
    noiseSeed = (noiseSeed * 16_807) % 2_147_483_647;
    return (noiseSeed / 2_147_483_647) * 2 - 1;
  }
}

function noteAt(notes: readonly number[], phase: number): number {
  return notes[Math.floor(phase) % notes.length];
}

function softSine(frequency: number, time: number): number {
  return Math.sin(TAU * frequency * time) * 0.82 + Math.sin(TAU * frequency * 2 * time) * 0.18;
}

function triangle(frequency: number, time: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(TAU * frequency * time));
}

function pulseEnvelope(phase: number, width: number, decay: number): number {
  const local = phase - Math.floor(phase);
  if (local > width) return 0;
  return Math.exp(-local * decay);
}

function edgeFade(time: number, duration: number, fadeSeconds: number): number {
  return Math.min(1, time / fadeSeconds, (duration - time) / fadeSeconds);
}

function clamp16(value: number): number {
  return Math.max(-32_768, Math.min(32_767, Math.round(value)));
}

function wav(pcm: Int16Array): Buffer {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataBytes = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let index = 0; index < pcm.length; index += 1) {
    buffer.writeInt16LE(pcm[index], 44 + index * 2);
  }

  return buffer;
}
