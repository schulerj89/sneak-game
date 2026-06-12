import { distance } from './math';
import type { LevelDefinition, ObjectiveProgress, Vec2 } from './types';

export function collectNearbyObjectives(
  level: LevelDefinition,
  playerPosition: Vec2,
  collectedIds: ReadonlySet<string>,
): Set<string> {
  const next = new Set(collectedIds);
  for (const objective of level.objectives ?? []) {
    if (distance(playerPosition, objective.position) <= objective.radius) {
      next.add(objective.id);
    }
  }
  return next;
}

export function getObjectiveProgress(level: LevelDefinition, collectedIds: ReadonlySet<string>): ObjectiveProgress {
  const required = (level.objectives ?? []).filter((objective) => objective.required);
  const collectedRequired = required.filter((objective) => collectedIds.has(objective.id)).length;

  return {
    totalRequired: required.length,
    collectedRequired,
    exitUnlocked: collectedRequired === required.length,
    collectedIds: [...collectedIds],
    items: (level.objectives ?? []).map((objective) => ({
      id: objective.id,
      type: objective.type,
      label: objective.label,
      required: objective.required,
      collected: collectedIds.has(objective.id),
    })),
  };
}
