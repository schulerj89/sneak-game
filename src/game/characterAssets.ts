import * as THREE from 'three';
import type { RenderQuality } from './types';
import heroUrl from '../assets/characters/hero-cinematic.glb?url';
import sentryUrl from '../assets/characters/sentry-cinematic.glb?url';

export type CharacterAssetType = 'hero' | 'sentry';

type RuntimeGltfLoader = {
  loadAsync: (url: string) => Promise<{ scene: THREE.Group }>;
};

const characterAssetUrls: Record<CharacterAssetType, string> = {
  hero: heroUrl,
  sentry: sentryUrl,
};

export class CharacterAssetLibrary {
  private readonly cinematicAssets = new Map<CharacterAssetType, THREE.Group>();
  private loaderPromise: Promise<RuntimeGltfLoader> | null = null;
  private preloadPromise: Promise<void> | null = null;

  async preload(quality: RenderQuality): Promise<void> {
    if (quality !== 'cinematic' || this.hasAllAssets()) return;

    this.preloadPromise ??= Promise.all((Object.keys(characterAssetUrls) as CharacterAssetType[]).map((type) => this.loadAsset(type)))
      .then(() => undefined)
      .catch((error: unknown) => {
        this.preloadPromise = null;
        console.warn(`[assets] cinematic character assets unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    await this.preloadPromise;
  }

  createHero(quality: RenderQuality): THREE.Object3D {
    const asset = quality === 'cinematic' ? this.cinematicAssets.get('hero') : null;
    const object = asset ? this.cloneAsset(asset, 'player:cinematic') : createSimpleHeroObject();
    object.position.set(0, 0, 0);
    return object;
  }

  createEnemy(id: string, quality: RenderQuality): THREE.Object3D {
    const asset = quality === 'cinematic' ? this.cinematicAssets.get('sentry') : null;
    const object = asset ? this.cloneAsset(asset, `enemy:${id}:cinematic`) : createSimpleEnemyObject(id);
    object.position.set(0, 0, 0);
    return object;
  }

  hasCinematicAssets(): boolean {
    return this.hasAllAssets();
  }

  dispose(): void {
    for (const asset of this.cinematicAssets.values()) {
      asset.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.cinematicAssets.clear();
    this.loaderPromise = null;
    this.preloadPromise = null;
  }

  private cloneAsset(asset: THREE.Group, name: string): THREE.Group {
    const clone = asset.clone(true);
    clone.name = name;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }

  private hasAllAssets(): boolean {
    return (Object.keys(characterAssetUrls) as CharacterAssetType[]).every((type) => this.cinematicAssets.has(type));
  }

  private async loadAsset(type: CharacterAssetType): Promise<void> {
    if (this.cinematicAssets.has(type)) return;

    const loader = await this.loader();
    const gltf = await loader.loadAsync(characterAssetUrls[type]);
    const group = new THREE.Group();
    group.name = `character-asset:${type}`;
    gltf.scene.position.y = type === 'hero' ? -0.48 : -0.55;
    group.add(gltf.scene);
    group.scale.setScalar(type === 'hero' ? 0.72 : 0.78);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.cinematicAssets.set(type, group);
    console.info(`[assets] loaded cinematic character ${type}`);
  }

  private loader(): Promise<RuntimeGltfLoader> {
    this.loaderPromise ??= import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader());
    return this.loaderPromise;
  }
}

export function createSimpleHeroObject(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.32, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#7dfcc6', emissive: '#12382f', roughness: 0.55 }),
  );
  mesh.castShadow = true;
  mesh.name = 'player:simple';
  return mesh;
}

export function createSimpleEnemyObject(id: string): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.8, 5),
    new THREE.MeshStandardMaterial({ color: '#ff5964', emissive: '#441219', roughness: 0.52 }),
  );
  mesh.castShadow = true;
  mesh.rotation.x = Math.PI;
  mesh.name = `enemy:${id}:simple`;
  return mesh;
}
