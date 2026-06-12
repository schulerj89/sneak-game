import type { LevelDefinition } from './types';

const sharedCrates = [
  { id: 'crate-a', center: { x: -3.1, z: -0.7 }, size: { x: 1.2, z: 2.3 }, height: 1.35 },
  { id: 'crate-b', center: { x: 1.4, z: 1.1 }, size: { x: 1.1, z: 3.4 }, height: 1.55 },
  { id: 'crate-c', center: { x: 4.1, z: -1.8 }, size: { x: 1.6, z: 1.1 }, height: 1.1 },
] as const;

export const levels: readonly LevelDefinition[] = [
  {
    id: 'dock-blackout',
    name: 'Dock Blackout',
    briefing: 'Slip through a half-lit cargo bay and reach the service hatch.',
    floorSize: { x: 12, z: 9 },
    start: { x: -5, z: 3.4 },
    goal: { x: 5, z: -3.2 },
    goalRadius: 0.55,
    obstacles: sharedCrates,
    lights: [
      { id: 'lamp-north', position: { x: -2.5, z: -3.2 }, height: 3.4, color: '#6ab7ff', intensity: 95, radius: 5.6 },
      { id: 'lamp-exit', position: { x: 4.6, z: -2.8 }, height: 2.9, color: '#a7ffcb', intensity: 55, radius: 3.2 },
    ],
    enemies: [
      {
        id: 'guard-dock',
        start: { x: -0.2, z: -2.5 },
        patrol: [
          { x: -0.2, z: -2.5 },
          { x: 3.2, z: -2.5 },
          { x: 3.2, z: 2.6 },
          { x: -0.2, z: 2.6 },
        ],
        speed: 1.08,
        visionRange: 3.2,
        visionAngleDegrees: 64,
        pauseSeconds: 0.3,
      },
    ],
    validationRoute: [
      { x: -5, z: 3.4 },
      { x: -4.8, z: -3.8 },
      { x: -1.6, z: -3.8 },
      { x: -1.0, z: -1.2 },
      { x: 2.4, z: -3.4 },
      { x: 5, z: -3.2 },
    ],
  },
  {
    id: 'archive-lanes',
    name: 'Archive Lanes',
    briefing: 'Cross the records room while patrols sweep the narrow aisles.',
    floorSize: { x: 14, z: 10 },
    start: { x: -6, z: 4 },
    goal: { x: 6.1, z: -4 },
    goalRadius: 0.55,
    obstacles: [
      { id: 'shelf-a', center: { x: -3.5, z: 0 }, size: { x: 0.9, z: 7.2 }, height: 1.8 },
      { id: 'shelf-b', center: { x: 0.2, z: 0.8 }, size: { x: 0.9, z: 7.2 }, height: 1.8 },
      { id: 'shelf-c', center: { x: 3.8, z: -0.7 }, size: { x: 0.9, z: 7.2 }, height: 1.8 },
      { id: 'desk', center: { x: -5.3, z: -2.6 }, size: { x: 1.7, z: 1.3 }, height: 1.0 },
    ],
    lights: [
      { id: 'lamp-aisle-a', position: { x: -5.3, z: 1.8 }, height: 3.3, color: '#ffd58a', intensity: 62, radius: 4.1 },
      { id: 'lamp-aisle-b', position: { x: 1.9, z: -1.8 }, height: 3.2, color: '#76d7ff', intensity: 72, radius: 4.8 },
      { id: 'lamp-goal', position: { x: 5.9, z: -3.5 }, height: 2.7, color: '#7dff9b', intensity: 48, radius: 3.0 },
    ],
    enemies: [
      {
        id: 'guard-archive-a',
        start: { x: -1.8, z: 3.5 },
        patrol: [
          { x: -1.8, z: 3.5 },
          { x: -1.8, z: -3.5 },
        ],
        speed: 0.95,
        visionRange: 3.3,
        visionAngleDegrees: 58,
        pauseSeconds: 0.45,
      },
      {
        id: 'guard-archive-b',
        start: { x: 2.1, z: -3.7 },
        patrol: [
          { x: 2.1, z: -3.7 },
          { x: 2.1, z: 3.6 },
        ],
        speed: 1.05,
        visionRange: 3.1,
        visionAngleDegrees: 58,
        pauseSeconds: 0.25,
      },
    ],
    validationRoute: [
      { x: -6, z: 4 },
      { x: -6.5, z: 4.7 },
      { x: -6.5, z: -3.9 },
      { x: -2.1, z: -4.1 },
      { x: -1.5, z: 4.7 },
      { x: 1.7, z: 4.7 },
      { x: 2.6, z: -4.6 },
      { x: 4.6, z: -4.6 },
      { x: 6.1, z: -4 },
    ],
  },
  {
    id: 'reactor-core',
    name: 'Reactor Core',
    briefing: 'Use cover and timing to cross the reactor floor before lockdown.',
    floorSize: { x: 16, z: 11 },
    start: { x: -7, z: 4.4 },
    goal: { x: 7.1, z: -4.4 },
    goalRadius: 0.58,
    obstacles: [
      { id: 'reactor', center: { x: 0, z: 0 }, size: { x: 2.4, z: 2.4 }, height: 2.35 },
      { id: 'console-a', center: { x: -4.7, z: -2.8 }, size: { x: 2.2, z: 1.0 }, height: 1.1 },
      { id: 'console-b', center: { x: 4.7, z: 2.7 }, size: { x: 2.2, z: 1.0 }, height: 1.1 },
      { id: 'pillar-a', center: { x: -2.9, z: 3.1 }, size: { x: 1.1, z: 1.1 }, height: 2.4 },
      { id: 'pillar-b', center: { x: 2.9, z: -3.1 }, size: { x: 1.1, z: 1.1 }, height: 2.4 },
    ],
    lights: [
      { id: 'core-blue', position: { x: 0, z: 0 }, height: 3.1, color: '#57c7ff', intensity: 135, radius: 6.8 },
      { id: 'warning-left', position: { x: -5.6, z: -3.8 }, height: 2.6, color: '#ff5f68', intensity: 52, radius: 3.1 },
      { id: 'warning-right', position: { x: 5.8, z: 3.8 }, height: 2.6, color: '#ffb35f', intensity: 52, radius: 3.1 },
    ],
    enemies: [
      {
        id: 'guard-core-a',
        start: { x: -5.6, z: 0.1 },
        patrol: [
          { x: -5.6, z: 0.1 },
          { x: -1.9, z: -3.6 },
          { x: 1.8, z: -3.6 },
        ],
        speed: 1.15,
        visionRange: 3.6,
        visionAngleDegrees: 62,
        pauseSeconds: 0.2,
      },
      {
        id: 'guard-core-b',
        start: { x: 5.6, z: -0.1 },
        patrol: [
          { x: 5.6, z: -0.1 },
          { x: 1.9, z: 3.6 },
          { x: -1.8, z: 3.6 },
        ],
        speed: 1.12,
        visionRange: 3.6,
        visionAngleDegrees: 62,
        pauseSeconds: 0.2,
      },
    ],
    validationRoute: [
      { x: -7, z: 4.4 },
      { x: -6.8, z: -4.4 },
      { x: -3.2, z: -4.5 },
      { x: -2.5, z: 1.6 },
      { x: 2.3, z: 4.5 },
      { x: 6.7, z: 4.2 },
      { x: 7.1, z: -4.4 },
    ],
  },
];

export function getLevel(index: number): LevelDefinition {
  return levels[((index % levels.length) + levels.length) % levels.length];
}
