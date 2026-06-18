import * as THREE from 'three';

type DisposalTracker = {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
};

export type DisposalStats = Readonly<{
  geometries: number;
  materials: number;
  textures: number;
}>;

export function disposeObjectResources(root: THREE.Object3D): DisposalStats {
  const tracker: DisposalTracker = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    disposeGeometry(child.geometry, tracker);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => disposeMaterialWithTextures(material, tracker));
  });

  return {
    geometries: tracker.geometries.size,
    materials: tracker.materials.size,
    textures: tracker.textures.size,
  };
}

function disposeGeometry(geometry: THREE.BufferGeometry, tracker: DisposalTracker): void {
  if (tracker.geometries.has(geometry)) return;

  geometry.dispose();
  tracker.geometries.add(geometry);
}

function disposeMaterialWithTextures(material: THREE.Material, tracker: DisposalTracker): void {
  if (tracker.materials.has(material)) return;

  for (const texture of materialTextures(material)) {
    if (tracker.textures.has(texture)) continue;
    texture.dispose();
    tracker.textures.add(texture);
  }
  material.dispose();
  tracker.materials.add(material);
}

function materialTextures(material: THREE.Material): readonly THREE.Texture[] {
  const textures = new Set<THREE.Texture>();

  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      textures.add(value);
    }
  }

  if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) {
      if (uniform.value instanceof THREE.Texture) {
        textures.add(uniform.value);
      }
    }
  }

  return [...textures];
}
