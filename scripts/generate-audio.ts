import { mkdir, writeFile } from 'node:fs/promises';

const TAU = Math.PI * 2;
const sampleRate = 22_050;
const seconds = 28;
const samples = sampleRate * seconds;
const channels = 1;
const bitsPerSample = 16;
const data = new Int16Array(samples);

const tempo = 2.12;
const bassNotes = [55, 41.2, 65.41, 49, 73.42, 49, 55, 82.41];
const arpNotes = [220, 246.94, 329.63, 392, 329.63, 246.94, 196, 246.94];

let noiseSeed = 12_345;

for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  const beat = time * tempo;
  const bass = noteAt(bassNotes, beat / 2);
  const arp = noteAt(arpNotes, beat * 2);
  const bassEnv = pulseEnvelope(beat, 0.78, 2.0);
  const subEnv = pulseEnvelope(beat, 0.88, 1.5);
  const arpEnv = pulseEnvelope(beat * 2, 0.32, 7.2);
  const kickEnv = pulseEnvelope(beat, 0.2, 13);
  const hatEnv = pulseEnvelope(beat * 4 + 0.5, 0.08, 24);

  const shimmer = Math.sin(TAU * (arp * 2.01) * time) * 0.04 * arpEnv;
  const bassTone = softSine(bass, time) * 0.48 * bassEnv;
  const subBass = Math.sin(TAU * (bass / 2) * time) * 0.28 * subEnv;
  const arpTone = triangle(arp, time) * 0.15 * arpEnv;
  const kick = Math.sin(TAU * (54 - kickEnv * 24) * time) * 0.34 * kickEnv;
  const hat = noise() * 0.07 * hatEnv;
  const roomBreath = Math.sin(TAU * 0.07 * time) * 0.05;
  const fade = edgeFade(time, seconds, 1.4);

  data[index] = clamp16((bassTone + subBass + arpTone + shimmer + kick + hat + roomBreath) * fade * 23_500);
}

await mkdir('src/assets', { recursive: true });
await writeFile('src/assets/shadow-circuit-theme.wav', wav(data));
console.info('[assets] wrote src/assets/shadow-circuit-theme.wav');

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

function noise(): number {
  noiseSeed = (noiseSeed * 16_807) % 2_147_483_647;
  return (noiseSeed / 2_147_483_647) * 2 - 1;
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
