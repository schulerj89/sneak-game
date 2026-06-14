import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const assets = [
  new URL('../assets/characters/hero-cinematic.glb', import.meta.url),
  new URL('../assets/characters/sentry-cinematic.glb', import.meta.url),
] as const;

describe('cinematic character assets', () => {
  it('keeps GLB assets valid and small enough for level loading', () => {
    for (const asset of assets) {
      const bytes = statSync(asset).size;
      const header = readFileSync(asset, { flag: 'r' }).subarray(0, 8);

      expect.soft(bytes).toBeGreaterThan(1024);
      expect.soft(bytes).toBeLessThan(75_000);
      expect.soft(header.subarray(0, 4).toString('utf8')).toBe('glTF');
      expect.soft(header.readUInt32LE(4)).toBe(2);
    }
  });
});
