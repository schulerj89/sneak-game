import type { RectObstacle, Vec2 } from './types';

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function scale(v: Vec2, value: number): Vec2 {
  return { x: v.x * value, z: v.z * value };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.z);
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  return len === 0 ? { x: 0, z: 0 } : { x: v.x / len, z: v.z / len };
}

export function distance(a: Vec2, b: Vec2): number {
  return length(subtract(a, b));
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampToRoom(point: Vec2, floorSize: Vec2, margin: number): Vec2 {
  return {
    x: clamp(point.x, -floorSize.x / 2 + margin, floorSize.x / 2 - margin),
    z: clamp(point.z, -floorSize.z / 2 + margin, floorSize.z / 2 - margin),
  };
}

export function pointInRect(point: Vec2, obstacle: RectObstacle, padding = 0): boolean {
  const halfX = obstacle.size.x / 2 + padding;
  const halfZ = obstacle.size.z / 2 + padding;
  return (
    point.x >= obstacle.center.x - halfX &&
    point.x <= obstacle.center.x + halfX &&
    point.z >= obstacle.center.z - halfZ &&
    point.z <= obstacle.center.z + halfZ
  );
}

export function segmentIntersectsRect(a: Vec2, b: Vec2, obstacle: RectObstacle, padding = 0): boolean {
  if (pointInRect(a, obstacle, padding) || pointInRect(b, obstacle, padding)) {
    return true;
  }

  const min = {
    x: obstacle.center.x - obstacle.size.x / 2 - padding,
    z: obstacle.center.z - obstacle.size.z / 2 - padding,
  };
  const max = {
    x: obstacle.center.x + obstacle.size.x / 2 + padding,
    z: obstacle.center.z + obstacle.size.z / 2 + padding,
  };

  const edges: readonly [Vec2, Vec2][] = [
    [{ x: min.x, z: min.z }, { x: max.x, z: min.z }],
    [{ x: max.x, z: min.z }, { x: max.x, z: max.z }],
    [{ x: max.x, z: max.z }, { x: min.x, z: max.z }],
    [{ x: min.x, z: max.z }, { x: min.x, z: min.z }],
  ];

  return edges.some(([edgeA, edgeB]) => segmentsIntersect(a, b, edgeA, edgeB));
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const direction = (p: Vec2, q: Vec2, r: Vec2): number =>
    (r.x - p.x) * (q.z - p.z) - (q.x - p.x) * (r.z - p.z);

  const onSegment = (p: Vec2, q: Vec2, r: Vec2): boolean =>
    Math.min(p.x, r.x) <= q.x &&
    q.x <= Math.max(p.x, r.x) &&
    Math.min(p.z, r.z) <= q.z &&
    q.z <= Math.max(p.z, r.z);

  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);
  const epsilon = 0.000001;

  if (((d1 > epsilon && d2 < -epsilon) || (d1 < -epsilon && d2 > epsilon)) &&
    ((d3 > epsilon && d4 < -epsilon) || (d3 < -epsilon && d4 > epsilon))) {
    return true;
  }

  if (Math.abs(d1) <= epsilon && onSegment(c, a, d)) return true;
  if (Math.abs(d2) <= epsilon && onSegment(c, b, d)) return true;
  if (Math.abs(d3) <= epsilon && onSegment(a, c, b)) return true;
  if (Math.abs(d4) <= epsilon && onSegment(a, d, b)) return true;

  return false;
}
