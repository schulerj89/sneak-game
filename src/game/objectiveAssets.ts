import * as THREE from 'three';
import type { ObjectiveDefinition, ObjectiveType, RenderQuality, Vec2 } from './types';
import { disposeObjectResources } from './threeDisposal';
import keycardUrl from '../assets/objectives/keycard-cinematic.glb?url';
import terminalUrl from '../assets/objectives/terminal-cinematic.glb?url';

type RuntimeGltfLoader = {
  loadAsync: (url: string) => Promise<{ scene: THREE.Group }>;
};

const objectiveAssetUrls: Record<ObjectiveType, string> = {
  keycard: keycardUrl,
  terminal: terminalUrl,
};
const objectiveHaloTexture = createObjectiveHaloTexture();

export const objectiveGlowColor: Record<ObjectiveType, string> = {
  keycard: '#ffd45a',
  terminal: '#5ad7ff',
};

export const objectiveGlowEmissive: Record<ObjectiveType, string> = {
  keycard: '#f0a51b',
  terminal: '#2bcfff',
};

export const objectiveGlowLightIntensity: Record<ObjectiveType, number> = {
  keycard: 32,
  terminal: 30,
};

export const objectiveGlowLightDistance = 3;
export const objectiveGlowLightDecay = 1.4;
export const objectiveGlowSpriteOpacity: Record<ObjectiveType, number> = {
  keycard: 0.38,
  terminal: 0.32,
};

export class ObjectiveAssetLibrary {
  private readonly cinematicAssets = new Map<ObjectiveType, THREE.Group>();
  private loaderPromise: Promise<RuntimeGltfLoader> | null = null;
  private preloadPromise: Promise<void> | null = null;

  async preload(quality: RenderQuality): Promise<void> {
    if (quality !== 'cinematic' || this.hasAllAssets()) return;

    this.preloadPromise ??= Promise.all((Object.keys(objectiveAssetUrls) as ObjectiveType[]).map((type) => this.loadAsset(type)))
      .then(() => undefined)
      .catch((error: unknown) => {
        this.preloadPromise = null;
        console.warn(`[assets] cinematic objective assets unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    await this.preloadPromise;
  }

  create(spec: ObjectiveDefinition, quality: RenderQuality): THREE.Object3D {
    const asset = quality === 'cinematic' ? this.cinematicAssets.get(spec.type) : null;
    if (!asset) return createSimpleObjectiveObject(spec);

    const clone = asset.clone(true);
    clone.position.set(spec.position.x, 0.12, spec.position.z);
    clone.rotation.y = spec.type === 'keycard' ? -0.35 : 0.45;
    clone.name = `objective:${spec.id}:cinematic`;
    clone.traverse((child) => {
      child.name ||= `objective-part:${spec.id}`;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }

  hasCinematicAssets(): boolean {
    return this.hasAllAssets();
  }

  dispose(): void {
    for (const asset of this.cinematicAssets.values()) {
      disposeObjectResources(asset);
    }
    this.cinematicAssets.clear();
    this.loaderPromise = null;
    this.preloadPromise = null;
  }

  private hasAllAssets(): boolean {
    return (Object.keys(objectiveAssetUrls) as ObjectiveType[]).every((type) => this.cinematicAssets.has(type));
  }

  private async loadAsset(type: ObjectiveType): Promise<void> {
    if (this.cinematicAssets.has(type)) return;

    const loader = await this.loader();
    const gltf = await loader.loadAsync(objectiveAssetUrls[type]);
    const group = new THREE.Group();
    group.name = `objective-asset:${type}`;
    normalizeObjectiveScene(gltf.scene, type);
    group.add(gltf.scene);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        prepareObjectiveMaterial(child.material, type);
      }
    });
    this.cinematicAssets.set(type, group);
    console.info(`[assets] loaded cinematic objective ${type}`);
  }

  private loader(): Promise<RuntimeGltfLoader> {
    this.loaderPromise ??= import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader());
    return this.loaderPromise;
  }
}

export function createObjectiveGlow(type: ObjectiveType, position: Vec2): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `objective-glow:${type}`;

  const light = new THREE.PointLight(objectiveGlowColor[type], objectiveGlowLightIntensity[type], objectiveGlowLightDistance, objectiveGlowLightDecay);
  light.castShadow = false;
  light.position.set(0, type === 'keycard' ? 0.44 : 0.62, 0);
  light.name = `objective-glow-light:${type}`;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: objectiveGlowColor[type],
      map: objectiveHaloTexture,
      transparent: true,
      opacity: objectiveGlowSpriteOpacity[type],
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.name = `objective-glow-halo:${type}`;
  sprite.position.set(0, type === 'keycard' ? 0.3 : 0.44, 0);
  sprite.scale.setScalar(type === 'keycard' ? 1.22 : 1.42);

  group.position.set(position.x, 0, position.z);
  group.add(light, sprite);
  return group;
}

function createObjectiveHaloTexture(): THREE.DataTexture {
  const size = 64;
  const center = (size - 1) / 2;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, 1 - distance);
      const easedAlpha = Math.round(Math.pow(alpha, 2.6) * 255);
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = easedAlpha;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function normalizeObjectiveScene(scene: THREE.Object3D, type: ObjectiveType): void {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z);
  if (longestSide > 0) {
    scene.scale.multiplyScalar((type === 'keycard' ? 0.82 : 0.96) / longestSide);
  }

  scene.updateMatrixWorld(true);
  const normalizedBox = new THREE.Box3().setFromObject(scene);
  const center = normalizedBox.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.y -= normalizedBox.min.y;
  scene.position.z -= center.z;
}

function prepareObjectiveMaterial(material: THREE.Material | THREE.Material[], type: ObjectiveType): void {
  const materials = Array.isArray(material) ? material : [material];
  const emissive = new THREE.Color(objectiveGlowEmissive[type]);
  const lift = new THREE.Color(type === 'keycard' ? '#fff0b3' : '#d8fbff');
  for (const item of materials) {
    item.side = THREE.DoubleSide;

    if (item instanceof THREE.MeshStandardMaterial) {
      item.color.lerp(lift, type === 'keycard' ? 0.08 : 0.06);
      item.roughness = Math.min(item.roughness, 0.48);
      item.metalness = Math.max(item.metalness, 0.12);
      item.emissive.lerp(emissive, 0.72);
      item.emissiveMap ??= item.map;
      item.emissiveIntensity = Math.max(item.emissiveIntensity, type === 'keycard' ? 0.92 : 0.78);
    }

    item.needsUpdate = true;
  }
}

export function createSimpleObjectiveObject(spec: ObjectiveDefinition): THREE.Object3D {
  const isKeycard = spec.type === 'keycard';
  const mesh = new THREE.Mesh(
    isKeycard ? new THREE.BoxGeometry(0.52, 0.08, 0.32) : new THREE.BoxGeometry(0.66, 0.24, 0.46),
    new THREE.MeshStandardMaterial({
      color: isKeycard ? '#ffd45a' : '#5ad7ff',
      emissive: isKeycard ? '#6d4c08' : '#063f58',
      emissiveIntensity: 0.9,
      roughness: 0.38,
      metalness: 0.18,
    }),
  );
  mesh.position.set(spec.position.x, isKeycard ? 0.16 : 0.24, spec.position.z);
  mesh.rotation.y = isKeycard ? -0.35 : 0.45;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `objective:${spec.id}:simple`;
  return mesh;
}
