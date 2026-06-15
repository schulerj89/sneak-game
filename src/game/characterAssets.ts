import * as THREE from 'three';
import type { RenderQuality } from './types';
import { defaultHeroId, heroOptionById, heroOptions, type HeroId } from './heroes';
import sentryUrl from '../assets/characters/sentry/enemy_sentry.glb?url';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type CharacterAssetType = 'hero' | 'sentry';
export type CharacterMotionState = 'idle' | 'run';
export type CharacterAssetInstance = {
  object: THREE.Object3D;
  animator: CharacterAnimator | null;
};

type RuntimeGltfLoader = {
  loadAsync: (url: string) => Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>;
};

type CinematicCharacterAsset = {
  scene: THREE.Group;
  clips: CharacterAnimationClips;
};

type CharacterAnimationClips = {
  idle?: THREE.AnimationClip;
  run?: THREE.AnimationClip;
  single?: THREE.AnimationClip;
};

const sentryAssetKey = 'sentry';

export class CharacterAnimator {
  private readonly object: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<CharacterMotionState | 'single', THREE.AnimationAction>();
  private activeState: CharacterMotionState | 'single' | null = null;

  constructor(object: THREE.Object3D, clips: CharacterAnimationClips) {
    this.object = object;
    this.mixer = new THREE.AnimationMixer(object);
    this.addAction('idle', clips.idle);
    this.addAction('run', clips.run);
    this.addAction('single', clips.single);

    if (this.actions.has('idle')) {
      this.setMotionState('idle', 0);
    } else if (this.actions.has('single')) {
      this.playSingle();
    }
  }

  setMotionState(state: CharacterMotionState, fadeSeconds = 0.18): void {
    const nextAction = this.actions.get(state);
    if (!nextAction || this.activeState === state) return;

    const currentAction = this.activeState ? this.actions.get(this.activeState) : null;
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (currentAction && fadeSeconds > 0) {
      currentAction.crossFadeTo(nextAction, fadeSeconds, false);
    } else if (currentAction) {
      currentAction.stop();
    }
    this.activeState = state;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  snapshot(): { activeState: CharacterMotionState | 'single' | null; clipNames: readonly string[] } {
    return {
      activeState: this.activeState,
      clipNames: [...this.actions.values()].map((action) => action.getClip().name),
    };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
    this.actions.clear();
    this.activeState = null;

    const skeletons = new Set<THREE.Skeleton>();
    this.object.traverse((child) => {
      const skinned = child as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh && skinned.skeleton) {
        skeletons.add(skinned.skeleton);
      }
    });
    skeletons.forEach((skeleton) => skeleton.dispose());
  }

  private addAction(state: CharacterMotionState | 'single', clip: THREE.AnimationClip | undefined): void {
    if (!clip) return;

    const action = this.mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = false;
    action.loop = THREE.LoopRepeat;
    this.actions.set(state, action);
  }

  private playSingle(): void {
    const action = this.actions.get('single');
    if (!action) return;

    action.reset();
    action.play();
    this.activeState = 'single';
  }
}

export class CharacterAssetLibrary {
  private readonly cinematicAssets = new Map<string, CinematicCharacterAsset>();
  private readonly loadingAssets = new Map<string, Promise<void>>();
  private loaderPromise: Promise<RuntimeGltfLoader> | null = null;

  async preload(quality: RenderQuality, heroId: HeroId = defaultHeroId): Promise<void> {
    if (quality !== 'cinematic' || this.hasAllAssets(heroId)) return;

    try {
      await Promise.all([
        this.loadHeroAssetById(heroId),
        this.loadSentryAssetIntoCache(),
      ]);
    } catch (error: unknown) {
      console.warn(`[assets] cinematic character assets unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async preloadHero(heroId: HeroId = defaultHeroId): Promise<void> {
    try {
      await this.loadHeroAssetById(heroId);
    } catch (error: unknown) {
      console.warn(`[assets] cinematic hero asset unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async preloadHeroRoster(): Promise<void> {
    try {
      await Promise.all(heroOptions.map((hero) => this.loadHeroAssetById(hero.id)));
    } catch (error: unknown) {
      console.warn(`[assets] cinematic hero roster unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createHero(quality: RenderQuality, heroId: HeroId = defaultHeroId): CharacterAssetInstance {
    const asset = quality === 'cinematic' ? this.cinematicAssets.get(heroAssetKey(heroId)) : null;
    const instance = asset ? this.cloneAsset(asset, `player:${heroId}:cinematic`) : { object: createSimpleHeroObject(), animator: null };
    const object = instance.object;
    object.position.set(0, 0, 0);
    return instance;
  }

  createEnemy(id: string, quality: RenderQuality): CharacterAssetInstance {
    const asset = quality === 'cinematic' ? this.cinematicAssets.get(sentryAssetKey) : null;
    const instance = asset ? this.cloneAsset(asset, `enemy:${id}:cinematic`) : { object: createSimpleEnemyObject(id), animator: null };
    const object = instance.object;
    object.position.set(0, 0, 0);
    return instance;
  }

  hasCinematicAssets(heroId: HeroId = defaultHeroId): boolean {
    return this.hasAllAssets(heroId);
  }

  hasHeroCinematicAsset(heroId: HeroId = defaultHeroId): boolean {
    return this.cinematicAssets.has(heroAssetKey(heroId));
  }

  loadedHeroIds(): readonly HeroId[] {
    return heroOptions.filter((hero) => this.cinematicAssets.has(heroAssetKey(hero.id))).map((hero) => hero.id);
  }

  releaseUnselectedHeroes(selectedHeroId: HeroId): void {
    for (const [key, asset] of this.cinematicAssets) {
      if (!key.startsWith('hero:') || key === heroAssetKey(selectedHeroId)) continue;

      this.disposeAsset(asset);
      this.cinematicAssets.delete(key);
      console.info(`[assets] released cinematic character ${key}`);
    }
  }

  dispose(): void {
    for (const asset of this.cinematicAssets.values()) {
      this.disposeAsset(asset);
    }
    this.cinematicAssets.clear();
    this.loadingAssets.clear();
    this.loaderPromise = null;
  }

  private cloneAsset(asset: CinematicCharacterAsset, name: string): CharacterAssetInstance {
    const object = cloneSkeleton(asset.scene);
    object.name = name;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const animator = hasAnimationClips(asset.clips) ? new CharacterAnimator(object, asset.clips) : null;
    return { object, animator };
  }

  private hasAllAssets(heroId: HeroId): boolean {
    return this.cinematicAssets.has(heroAssetKey(heroId)) && this.cinematicAssets.has(sentryAssetKey);
  }

  private async loadHeroAssetById(heroId: HeroId): Promise<void> {
    const key = heroAssetKey(heroId);
    await this.loadCachedAsset(key, 'hero', (loader) => this.loadHeroAsset(loader, heroId));
  }

  private async loadSentryAssetIntoCache(): Promise<void> {
    await this.loadCachedAsset(sentryAssetKey, 'sentry', (loader) => this.loadSentryAsset(loader));
  }

  private async loadCachedAsset(
    key: string,
    type: CharacterAssetType,
    load: (loader: RuntimeGltfLoader) => Promise<{ scene: THREE.Group; clips: CharacterAnimationClips }>,
  ): Promise<void> {
    if (this.cinematicAssets.has(key)) return;

    const pending = this.loadingAssets.get(key);
    if (pending) {
      await pending;
      return;
    }

    const promise = (async () => {
      const loader = await this.loader();
      const asset = await load(loader);
      const group = new THREE.Group();
      group.name = `character-asset:${key}`;
      normalizeCharacterScene(asset.scene, type);
      prepareCharacterMaterials(asset.scene, type);
      group.add(asset.scene);
      group.add(createCharacterAccentLight(type));
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.cinematicAssets.set(key, { scene: group, clips: asset.clips });
      console.info(`[assets] loaded cinematic character ${type} ${key} animations=${Object.keys(asset.clips).length}`);
    })();
    this.loadingAssets.set(key, promise);
    try {
      await promise;
    } finally {
      this.loadingAssets.delete(key);
    }
  }

  private loader(): Promise<RuntimeGltfLoader> {
    this.loaderPromise ??= import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader());
    return this.loaderPromise;
  }

  private async loadHeroAsset(loader: RuntimeGltfLoader, heroId: HeroId): Promise<{ scene: THREE.Group; clips: CharacterAnimationClips }> {
    const hero = heroOptionById(heroId);
    const [idleGltf, runGltf] = await Promise.all([loader.loadAsync(hero.idleUrl), loader.loadAsync(hero.runUrl)]);
    return {
      scene: idleGltf.scene,
      clips: {
        idle: findClip(idleGltf.animations, /idle/i),
        run: findClip(runGltf.animations, /run/i),
      },
    };
  }

  private async loadSentryAsset(loader: RuntimeGltfLoader): Promise<{ scene: THREE.Group; clips: CharacterAnimationClips }> {
    const gltf = await loader.loadAsync(sentryUrl);
    return {
      scene: gltf.scene,
      clips: {},
    };
  }

  private disposeAsset(asset: CinematicCharacterAsset): void {
    const disposedMaterials = new Set<THREE.Material>();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    asset.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (disposedMaterials.has(material)) return;
        material.dispose();
        disposedMaterials.add(material);
      });
    });
  }
}

function heroAssetKey(heroId: HeroId): string {
  return `hero:${heroId}`;
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

function normalizeCharacterScene(scene: THREE.Group, type: CharacterAssetType): void {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const targetHeight = type === 'hero' ? 1.42 : 1.52;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const bottomOffset = type === 'hero' ? -0.46 : -0.52;

  scene.position.set(-center.x * scale, bottomOffset - bounds.min.y * scale, -center.z * scale);
  scene.scale.setScalar(scale);
}

function prepareCharacterMaterials(scene: THREE.Group, type: CharacterAssetType): void {
  const accentColor = new THREE.Color(type === 'hero' ? '#53ffe2' : '#ff7548');
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const boostedMaterials = materials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshPhysicalMaterial)) {
        return material;
      }

      const boosted = material.clone();
      boosted.emissive.lerp(accentColor, 0.3);
      boosted.emissiveIntensity = Math.max(boosted.emissiveIntensity, type === 'hero' ? 0.18 : 0.14);
      boosted.roughness = Math.min(boosted.roughness, 0.68);
      boosted.needsUpdate = true;
      return boosted;
    });
    child.material = Array.isArray(child.material) ? boostedMaterials : boostedMaterials[0];
  });
}

function createCharacterAccentLight(type: CharacterAssetType): THREE.PointLight {
  const light = new THREE.PointLight(type === 'hero' ? '#53ffe2' : '#ff7548', type === 'hero' ? 3 : 2.4, 2.4);
  light.position.set(0, 0.45, 0.18);
  light.castShadow = false;
  light.name = `character-accent-light:${type}`;
  return light;
}

function findClip(animations: readonly THREE.AnimationClip[], pattern: RegExp): THREE.AnimationClip | undefined {
  return animations.find((animation) => pattern.test(animation.name)) ?? animations[0];
}

function hasAnimationClips(clips: CharacterAnimationClips): boolean {
  return Boolean(clips.idle || clips.run || clips.single);
}
