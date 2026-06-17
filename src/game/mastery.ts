import { loadLevelAchievementRecords } from './achievements';
import { loadRunRecordProgress } from './runStats';
import type { LevelDefinition, RunGrade, RunSummary } from './types';

export type MasteryMarkId = 'clear' | 's-rank' | 'par-time' | 'second-clear';

export type LevelMasteryMark = Readonly<{
  id: MasteryMarkId;
  label: string;
  complete: boolean;
}>;

export type LevelMasteryProgress = Readonly<{
  levelId: string;
  clears: number;
  bestGrade: RunGrade | null;
  bestTimeMs: number | null;
  completedMarks: number;
  totalMarks: number;
  marks: readonly LevelMasteryMark[];
  nextTarget: string;
}>;

export type MasterySummary = Readonly<{
  completedMarks: number;
  totalMarks: number;
  masteredLevels: number;
  totalLevels: number;
}>;

export type RetryTarget = Readonly<{
  label: string;
  detail: string;
}>;

export type EncorePick = Readonly<{
  levelId: string;
  levelIndex: number;
  levelName: string;
  label: string;
  detail: string;
  actionLabel: string;
  bestTimeMs: number | null;
  parTimeMs: number;
  marginMs: number | null;
}>;

const sRank: RunGrade = 'S';

export function loadLevelMasteryProgress(
  levels: readonly LevelDefinition[],
  storage: Storage | null = browserStorage(),
): readonly LevelMasteryProgress[] {
  const levelIds = levels.map((level) => level.id);
  const achievementRecords = new Map(loadLevelAchievementRecords(levelIds, storage).map((record) => [record.levelId, record]));
  const runRecords = new Map(loadRunRecordProgress(levelIds, storage).map((record) => [record.levelId, record]));

  return levels.map((level) => {
    const achievements = achievementRecords.get(level.id);
    const run = runRecords.get(level.id);
    return buildLevelMasteryProgress(level, achievements?.clears ?? 0, achievements?.bestGrade ?? null, run?.bestTimeMs ?? null);
  });
}

export function buildLevelMasteryProgress(
  level: LevelDefinition,
  clears: number,
  bestGrade: RunGrade | null,
  bestTimeMs: number | null,
): LevelMasteryProgress {
  const normalizedClears = Math.max(0, Math.floor(clears));
  const parTimeMs = level.parSeconds * 1000;
  const marks: readonly LevelMasteryMark[] = [
    { id: 'clear', label: 'Clear', complete: normalizedClears > 0 },
    { id: 's-rank', label: 'S', complete: bestGrade === sRank },
    { id: 'par-time', label: 'Par', complete: bestTimeMs !== null && bestTimeMs <= parTimeMs },
    { id: 'second-clear', label: '2x', complete: normalizedClears >= 2 },
  ];
  const completedMarks = marks.filter((mark) => mark.complete).length;

  return {
    levelId: level.id,
    clears: normalizedClears,
    bestGrade,
    bestTimeMs,
    completedMarks,
    totalMarks: marks.length,
    marks,
    nextTarget: nextMasteryTarget(level, normalizedClears, bestGrade, bestTimeMs),
  };
}

export function buildMasterySummary(mastery: readonly LevelMasteryProgress[]): MasterySummary {
  return {
    completedMarks: mastery.reduce((total, level) => total + level.completedMarks, 0),
    totalMarks: mastery.reduce((total, level) => total + level.totalMarks, 0),
    masteredLevels: mastery.filter((level) => level.completedMarks === level.totalMarks).length,
    totalLevels: mastery.length,
  };
}

export function buildEncorePick(
  levels: readonly LevelDefinition[],
  mastery: readonly LevelMasteryProgress[],
): EncorePick | null {
  if (levels.length === 0 || mastery.length < levels.length) return null;

  const masteryById = new Map(mastery.map((level) => [level.levelId, level]));
  const candidates = levels.map((level, levelIndex) => {
    const progress = masteryById.get(level.id);
    if (!progress || !isEncoreEligible(progress)) return null;

    const parTimeMs = level.parSeconds * 1000;
    const marginMs = progress.bestTimeMs === null ? null : parTimeMs - progress.bestTimeMs;
    return { level, levelIndex, progress, parTimeMs, marginMs };
  });

  if (candidates.some((candidate) => candidate === null)) return null;

  const [pick] = candidates
    .filter((candidate): candidate is NonNullable<(typeof candidates)[number]> => candidate !== null)
    .sort((a, b) => {
      if (a.marginMs === null && b.marginMs !== null) return -1;
      if (a.marginMs !== null && b.marginMs === null) return 1;
      if (a.marginMs !== null && b.marginMs !== null && a.marginMs !== b.marginMs) return a.marginMs - b.marginMs;
      return a.levelIndex - b.levelIndex;
    });
  if (!pick) return null;

  const hasBestTime = pick.progress.bestTimeMs !== null;
  return {
    levelId: pick.level.id,
    levelIndex: pick.levelIndex,
    levelName: pick.level.name,
    label: hasBestTime ? `Encore: Beat ${pick.level.name} ${formatRunTime(pick.progress.bestTimeMs ?? 0)}` : `Encore: Set ${pick.level.name} best`,
    detail: hasBestTime ? encoreMarginDetail(pick.marginMs ?? 0) : 'No best time saved yet.',
    actionLabel: hasBestTime ? 'Beat best' : 'Set best',
    bestTimeMs: pick.progress.bestTimeMs,
    parTimeMs: pick.parTimeMs,
    marginMs: pick.marginMs,
  };
}

function isEncoreEligible(progress: LevelMasteryProgress): boolean {
  if (progress.completedMarks >= progress.totalMarks) return true;
  return progress.clears >= 2 && progress.bestGrade === sRank && progress.bestTimeMs === null;
}

export function retryTargetForCompletion(
  level: LevelDefinition,
  summary: RunSummary,
  mastery: LevelMasteryProgress,
): RetryTarget {
  if (summary.grade !== sRank) {
    return {
      label: 'Retry for S',
      detail: 'Clean par run still open.',
    };
  }

  if (mastery.clears < 2) {
    return {
      label: 'Second clear ready',
      detail: 'Run it again to mark 2x.',
    };
  }

  if (summary.bestTimeMs !== null && !summary.isNewBest) {
    return {
      label: `Beat best ${formatRunTime(summary.bestTimeMs)}`,
      detail: 'Replay while the route is fresh.',
    };
  }

  if (mastery.completedMarks === mastery.totalMarks) {
    return {
      label: 'Level mastered',
      detail: 'All marks complete.',
    };
  }

  return {
    label: nextMasteryTarget(level, mastery.clears, mastery.bestGrade, mastery.bestTimeMs),
    detail: 'One more mark is available.',
  };
}

function nextMasteryTarget(
  level: LevelDefinition,
  clears: number,
  bestGrade: RunGrade | null,
  bestTimeMs: number | null,
): string {
  if (clears <= 0) return 'Clear the route';
  if (bestGrade !== sRank) return 'Replay for S';
  if (bestTimeMs === null || bestTimeMs > level.parSeconds * 1000) return `Beat par ${formatRunTime(level.parSeconds * 1000)}`;
  if (clears < 2) return 'Second clear ready';
  return bestTimeMs === null ? 'Set a best time' : `Beat best ${formatRunTime(bestTimeMs)}`;
}

export function formatRunTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function encoreMarginDetail(marginMs: number): string {
  if (marginMs <= 0) return 'Personal best is at par. Tighten the route.';
  return `${formatRunTime(marginMs)} under par is the tightest margin.`;
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
