import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const animatedAssets = [
  new URL('../assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb', import.meta.url),
  new URL('../assets/hero/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_2/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_2/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_3/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_3/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_4/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Idle_3_withSkin.glb', import.meta.url),
  new URL('../assets/hero/hero_4/Meshy_AI_a_small_tactical_chib_biped/Meshy_AI_a_small_tactical_chib_biped_Animation_Run_02_withSkin.glb', import.meta.url),
] as const;
const staticAssets = [
  new URL('../assets/characters/sentry/enemy_sentry.glb', import.meta.url),
] as const;

describe('cinematic character assets', () => {
  it('keeps animated hero GLB assets valid and detailed', () => {
    for (const asset of animatedAssets) {
      const { bytes, header, json } = readGlb(asset);

      expectValidDetailedGlb(bytes, header);
      expect.soft(json.animations?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps static sentry GLB assets valid and detailed', () => {
    for (const asset of staticAssets) {
      const { bytes, header, json } = readGlb(asset);

      expectValidDetailedGlb(bytes, header);
      expect.soft(json.animations?.length ?? 0).toBe(0);
    }
  });

  it('uses only idle and running hero animation sources', () => {
    const clipNames = animatedAssets
      .flatMap((asset) => readGlbJson(readFileSync(asset, { flag: 'r' })).animations?.map((animation) => animation.name) ?? []);

    expect(clipNames).toEqual(expect.arrayContaining([
      expect.stringMatching(/idle/i),
      expect.stringMatching(/run_?02/i),
    ]));
    expect(clipNames.some((name) => /run_?03/i.test(name))).toBe(false);
    expect(clipNames.some((name) => /walking/i.test(name))).toBe(false);
  });
});

function readGlb(asset: URL): { bytes: number; header: Buffer; json: { animations?: { name: string }[] } } {
  const bytes = statSync(asset).size;
  const data = readFileSync(asset, { flag: 'r' });
  return {
    bytes,
    header: data.subarray(0, 8),
    json: readGlbJson(data),
  };
}

function expectValidDetailedGlb(bytes: number, header: Buffer): void {
  expect.soft(bytes).toBeGreaterThan(1_000_000);
  expect.soft(bytes).toBeLessThan(90_000_000);
  expect.soft(header.subarray(0, 4).toString('utf8')).toBe('glTF');
  expect.soft(header.readUInt32LE(4)).toBe(2);
}

function readGlbJson(data: Buffer): { animations?: { name: string }[] } {
  const jsonChunkLength = data.readUInt32LE(12);
  const jsonChunkType = data.subarray(16, 20).toString('utf8');
  expect(jsonChunkType).toBe('JSON');
  return JSON.parse(data.subarray(20, 20 + jsonChunkLength).toString('utf8').trim()) as { animations?: { name: string }[] };
}
