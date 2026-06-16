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

    for (const marker of this.plan.objectiveMarkers) {
      this.group.add(createIntelPulseMarker(marker));
    }
    this.group.add(createIntelPulseMarker(this.plan.exitMarker));

    for (const route of this.plan.patrolRoutes) {
      this.group.add(createIntelPulseRoute(route));
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
}

function createIntelPulseMarker(marker: IntelPulseMarker): THREE.Group {
  const color = marker.type === 'exit' ? '#7dff9b' : marker.type === 'keycard' ? '#ffd45a' : '#5ad7ff';
  const group = new THREE.Group();
  group.position.set(marker.position.x, intelPulseFloorY, marker.position.z);
  group.name = `intel-marker:${marker.id}`;

  const ringRadius = Math.max(0.42, marker.radius + 0.14);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ringRadius, ringRadius + 0.12, 40),
    intelPulseMaterial(color, 0.9),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.name = `intel-ring:${marker.id}`;

  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(ringRadius * 0.68, 32),
    intelPulseMaterial(color, marker.type === 'exit' ? 0.18 : 0.14),
  );
  disk.rotation.x = -Math.PI / 2;
  disk.name = `intel-disk:${marker.id}`;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(ringRadius * 0.28, ringRadius * 0.54, 1.35, 28, 1, true),
    intelPulseMaterial(color, marker.type === 'exit' ? 0.24 : 0.18),
  );
  beacon.position.y = 0.7;
  beacon.name = `intel-beacon:${marker.id}`;

  group.add(disk, ring, beacon);
  return group;
}

function createIntelPulseRoute(route: IntelPulsePatrolRoute): THREE.Group {
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

  const waypointGeometry = new THREE.RingGeometry(0.12, 0.18, 18);
  for (const point of route.points) {
    const waypoint = new THREE.Mesh(waypointGeometry, intelPulseMaterial('#ffcf5a', 0.72));
    waypoint.position.set(point.x, intelPulseFloorY + 0.025, point.z);
    waypoint.rotation.x = -Math.PI / 2;
    waypoint.name = `intel-waypoint:${route.enemyId}`;
    group.add(waypoint);
  }

  return group;
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
