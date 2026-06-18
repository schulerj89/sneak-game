import { readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createObjectiveGlow, objectiveGlowLightDecay, objectiveGlowLightDistance, objectiveGlowLightIntensity, objectiveGlowSpriteOpacity } from './objectiveAssets';

const assets = [
  new URL('../assets/objectives/keycard-cinematic.glb', import.meta.url),
  new URL('../assets/objectives/terminal-cinematic.glb', import.meta.url),
] as const;

describe('cinematic objective assets', () => {
  it('keeps GLB assets valid, textured, and bounded for runtime preloading', () => {
    for (const asset of assets) {
      const data = readFileSync(asset, { flag: 'r' });
      const bytes = statSync(asset).size;
      const header = data.subarray(0, 8);
      const json = readGlbJson(data);

      expect.soft(bytes).toBeGreaterThan(1_000_000);
      expect.soft(bytes).toBeLessThan(18_000_000);
      expect.soft(header.subarray(0, 4).toString('utf8')).toBe('glTF');
      expect.soft(header.readUInt32LE(4)).toBe(2);
      expect.soft(json.meshes?.length ?? 0).toBeGreaterThan(0);
      expect.soft(json.materials?.length ?? 0).toBeGreaterThan(0);
      expect.soft(json.images?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('adds a cheap visible glow rig for cinematic objective readability', () => {
    for (const type of ['keycard', 'terminal'] as const) {
      const glow = createObjectiveGlow(type, { x: 2, z: -3 });
      const light = glow.children.find((child): child is THREE.PointLight => child instanceof THREE.PointLight);
      const halo = glow.children.find((child): child is THREE.Sprite => child instanceof THREE.Sprite);

      expect.soft(glow.position.x).toBe(2);
      expect.soft(glow.position.z).toBe(-3);
      expect.soft(light).toBeDefined();
      expect.soft(light?.intensity).toBe(objectiveGlowLightIntensity[type]);
      expect.soft(light?.distance).toBe(objectiveGlowLightDistance);
      expect.soft(light?.decay).toBe(objectiveGlowLightDecay);
      expect.soft(light?.castShadow).toBe(false);
      expect.soft(halo).toBeDefined();
      expect.soft(halo?.material).toBeInstanceOf(THREE.SpriteMaterial);
      expect.soft(halo?.material.map).toBeInstanceOf(THREE.DataTexture);
      expect.soft(halo?.material.opacity).toBe(objectiveGlowSpriteOpacity[type]);
      expect.soft(halo?.material.blending).toBe(THREE.AdditiveBlending);
      expect.soft(halo?.material.depthWrite).toBe(false);
      expect.soft(halo?.material.toneMapped).toBe(false);
    }
  });
});

function readGlbJson(data: Buffer): { images?: unknown[]; materials?: unknown[]; meshes?: unknown[] } {
  const jsonChunkLength = data.readUInt32LE(12);
  const jsonChunkType = data.subarray(16, 20).toString('utf8');
  expect(jsonChunkType).toBe('JSON');
  return JSON.parse(data.subarray(20, 20 + jsonChunkLength).toString('utf8').trim()) as {
    images?: unknown[];
    materials?: unknown[];
    meshes?: unknown[];
  };
}
