import type { EnemySpec, LevelDefinition, ObjectiveDefinition, ObjectiveType, Vec2 } from './types';

export type IntelPulseMarkerType = ObjectiveType | 'exit';

export type IntelPulseMarker = Readonly<{
  id: string;
  type: IntelPulseMarkerType;
  label: string;
  position: Vec2;
  radius: number;
}>;

export type IntelPulsePatrolRoute = Readonly<{
  enemyId: string;
  points: readonly Vec2[];
}>;

export type IntelPulsePlan = Readonly<{
  objectiveMarkers: readonly IntelPulseMarker[];
  exitMarker: IntelPulseMarker;
  patrolRoutes: readonly IntelPulsePatrolRoute[];
  waypointCount: number;
}>;

export type IntelPulsePlanOptions = Readonly<{
  includePatrols: boolean;
}>;

export function createIntelPulsePlan(
  level: LevelDefinition,
  collectedObjectiveIds: ReadonlySet<string>,
  options: IntelPulsePlanOptions,
): IntelPulsePlan {
  const objectiveMarkers = remainingObjectives(level.objectives ?? [], collectedObjectiveIds).map((objective) => ({
    id: objective.id,
    type: objective.type,
    label: objective.label,
    position: objective.position,
    radius: objective.radius,
  }));
  const patrolRoutes = options.includePatrols ? level.enemies.map(createPatrolRoute).filter((route) => route.points.length >= 2) : [];

  return {
    objectiveMarkers,
    exitMarker: {
      id: `${level.id}:exit`,
      type: 'exit',
      label: 'Exit',
      position: level.goal,
      radius: level.goalRadius,
    },
    patrolRoutes,
    waypointCount: patrolRoutes.reduce((total, route) => total + route.points.length, 0),
  };
}

function remainingObjectives(
  objectives: readonly ObjectiveDefinition[],
  collectedObjectiveIds: ReadonlySet<string>,
): readonly ObjectiveDefinition[] {
  return objectives.filter((objective) => !collectedObjectiveIds.has(objective.id));
}

function createPatrolRoute(enemy: EnemySpec): IntelPulsePatrolRoute {
  const points = uniqueConsecutivePoints([enemy.start, ...enemy.patrol]);
  return {
    enemyId: enemy.id,
    points,
  };
}

function uniqueConsecutivePoints(points: readonly Vec2[]): readonly Vec2[] {
  const unique: Vec2[] = [];
  for (const point of points) {
    const previous = unique.at(-1);
    if (previous && previous.x === point.x && previous.z === point.z) continue;

    unique.push(point);
  }
  return unique;
}
