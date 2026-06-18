import * as THREE from 'three';
import { createIntelPulsePlan, type IntelPulseMarker, type IntelPulsePatrolRoute, type IntelPulsePlan } from './intelPulse';
import type { LevelDefinition } from './types';

const intelPulseFloorY = 0.07;

export class IntelPulseVisuals {
  readonly group = new THREE.Group();
  plan: IntelPulsePlan | null = null;

  constructor() {
    this.group.name = 'intel-pulse';
  }

  rebuild(level: LevelDefinition, collectedObjectiveIds: ReadonlySet<string>, includePatrols: boolean): IntelPulsePlan {
    this.clear();
    this.plan = createIntelPulsePlan(level, collectedObjectiveIds, { includePatrols });

    this.group.add(...createIntelPulseMarkers([...this.plan.objectiveMarkers, this.plan.exitMarker]));

    for (const route of this.plan.patrolRoutes) {
      this.group.add(createIntelPulseRouteLine(route));
    }
    const waypoints = createIntelPulseWaypoints(this.plan.patrolRoutes);
    if (waypoints) {
      this.group.add(waypoints);
    }

    return this.plan;
  }

  clear(): void {
    disposeIntelPulseResources(this.group);
    this.group.clear();
    this.plan = null;
  }

  applyShimmer(factor: number): void {
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        const baseOpacity = typeof material.userData.intelPulseOpacity === 'number' ? material.userData.intelPulseOpacity : material.opacity;
        material.opacity = baseOpacity * factor;
      }
    });
  }

  stats(): {
    objects: number;
    meshes: number;
    instancedMeshes: number;
    lines: number;
    instances: number;
  } {
    const stats = {
      objects: 0,
      meshes: 0,
      instancedMeshes: 0,
      lines: 0,
      instances: 0,
    };

    this.group.traverse((child) => {
      if (child === this.group) return;

      stats.objects += 1;
      if (child instanceof THREE.InstancedMesh) {
        stats.instancedMeshes += 1;
        stats.instances += child.count;
        return;
      }
      if (child instanceof THREE.Mesh) {
        stats.meshes += 1;
        return;
      }
      if (child instanceof THREE.Line) {
        stats.lines += 1;
      }
    });

    return stats;
  }
}

type IntelPulseMarkerInstance = Readonly<{
  marker: IntelPulseMarker;
  color: string;
  ringRadius: number;
  diskOpacity: number;
  beaconOpacity: number;
}>;

type MarkerPart = 'ring' | 'disk' | 'beacon';

function createIntelPulseMarkers(markers: readonly IntelPulseMarker[]): THREE.Object3D[] {
  const instances = markers.map((marker): IntelPulseMarkerInstance => {
    const color = markerColor(marker);
    return {
      marker,
      color,
      ringRadius: Math.max(0.42, marker.radius + 0.14),
      diskOpacity: marker.type === 'exit' ? 0.18 : 0.14,
      beaconOpacity: marker.type === 'exit' ? 0.24 : 0.18,
    };
  });
  return [
    ...createMarkerPartBatches(instances, 'disk'),
    ...createMarkerPartBatches(instances, 'ring'),
    ...createMarkerPartBatches(instances, 'beacon'),
  ];
}

function markerColor(marker: IntelPulseMarker): string {
  return marker.type === 'exit' ? '#7dff9b' : marker.type === 'keycard' ? '#ffd45a' : '#5ad7ff';
}

function createMarkerPartBatches(instances: readonly IntelPulseMarkerInstance[], part: MarkerPart): THREE.InstancedMesh[] {
  const batches = new Map<string, IntelPulseMarkerInstance[]>();
  for (const instance of instances) {
    const opacity = part === 'ring' ? 0.9 : part === 'disk' ? instance.diskOpacity : instance.beaconOpacity;
    const key = `${instance.color}:${opacity}`;
    const batch = batches.get(key);
    if (batch) {
      batch.push(instance);
    } else {
      batches.set(key, [instance]);
    }
  }

  return [...batches.entries()].map(([key, batch]) => {
    const [color, opacityValue] = key.split(':');
    const opacity = Number(opacityValue);
    const mesh = new THREE.InstancedMesh(markerPartGeometry(part), intelPulseMaterial(color, opacity), batch.length);
    const transform = new THREE.Object3D();
    mesh.name = `intel-${part}-batch:${color}:${opacity}`;
    mesh.frustumCulled = true;

    batch.forEach((instance, index) => {
      applyMarkerPartTransform(mesh, transform, part, instance, index);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    return mesh;
  });
}

function markerPartGeometry(part: MarkerPart): THREE.BufferGeometry {
  if (part === 'ring') {
    return new THREE.RingGeometry(1, 1.12, 40);
  }
  if (part === 'disk') {
    return new THREE.CircleGeometry(1, 32);
  }
  return new THREE.CylinderGeometry(0.28, 0.54, 1.35, 28, 1, true);
}

function applyMarkerPartTransform(
  mesh: THREE.InstancedMesh,
  transform: THREE.Object3D,
  part: MarkerPart,
  instance: IntelPulseMarkerInstance,
  index: number,
): void {
  const { marker, ringRadius } = instance;
  transform.rotation.set(0, 0, 0);
  transform.scale.set(1, 1, 1);

  if (part === 'beacon') {
    transform.position.set(marker.position.x, intelPulseFloorY + 0.7, marker.position.z);
    transform.scale.set(ringRadius, 1, ringRadius);
  } else {
    const radius = part === 'ring' ? ringRadius : ringRadius * 0.68;
    transform.position.set(marker.position.x, intelPulseFloorY, marker.position.z);
    transform.rotation.x = -Math.PI / 2;
    transform.scale.set(radius, radius, 1);
  }

  transform.updateMatrix();
  mesh.setMatrixAt(index, transform.matrix);
}

function createIntelPulseRouteLine(route: IntelPulsePatrolRoute): THREE.Group {
  const group = new THREE.Group();
  group.name = `intel-route:${route.enemyId}`;
  const points = route.points.map((point) => new THREE.Vector3(point.x, intelPulseFloorY + 0.015, point.z));
  if (points.length >= 3) {
    points.push(points[0].clone());
  }

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    intelPulseLineMaterial('#ffcf5a', 0.72),
  );
  line.name = `intel-route-line:${route.enemyId}`;
  group.add(line);

  return group;
}

function createIntelPulseWaypoints(routes: readonly IntelPulsePatrolRoute[]): THREE.InstancedMesh | null {
  const points = routes.flatMap((route) => route.points);
  if (points.length === 0) return null;

  const mesh = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.12, 0.18, 18),
    intelPulseMaterial('#ffcf5a', 0.72),
    points.length,
  );
  const transform = new THREE.Object3D();
  mesh.name = 'intel-waypoint-batch';
  points.forEach((point, index) => {
    transform.position.set(point.x, intelPulseFloorY + 0.025, point.z);
    transform.rotation.set(-Math.PI / 2, 0, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function intelPulseMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.userData.intelPulseOpacity = opacity;
  return material;
}

function intelPulseLineMaterial(color: string, opacity: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.userData.intelPulseOpacity = opacity;
  return material;
}

function disposeIntelPulseResources(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;

    if (!geometries.has(child.geometry)) {
      child.geometry.dispose();
      geometries.add(child.geometry);
    }

    const materialList = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materialList) {
      if (materials.has(material)) continue;

      material.dispose();
      materials.add(material);
    }
  });
}
