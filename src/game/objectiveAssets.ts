import * as THREE from 'three';
import type { ObjectiveDefinition, ObjectiveType, RenderQuality } from './types';
import keycardUrl from '../assets/objectives/keycard-cinematic.glb?url';
import terminalUrl from '../assets/objectives/terminal-cinematic.glb?url';

type RuntimeGltfLoader = {
  loadAsync: (url: string) => Promise<{ scene: THREE.Group }>;
};

const objectiveAssetUrls: Record<ObjectiveType, string> = {
  keycard: keycardUrl,
  terminal: terminalUrl,
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
  const emissive = new THREE.Color(type === 'keycard' ? '#4f3605' : '#063f58');
  for (const item of materials) {
    item.side = THREE.DoubleSide;

    if (item instanceof THREE.MeshStandardMaterial) {
      item.roughness = Math.min(item.roughness, 0.48);
      item.metalness = Math.max(item.metalness, 0.12);
      item.emissive.lerp(emissive, 0.5);
      item.emissiveIntensity = Math.max(item.emissiveIntensity, type === 'keycard' ? 0.34 : 0.24);
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
