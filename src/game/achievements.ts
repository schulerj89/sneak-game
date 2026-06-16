import type { RunGrade } from './types';

const achievementsKey = 'shadow-circuit-achievements-v1';

export type AchievementId = 'complete-all-levels' | 'clean-entry' | 's-rank-all-levels' | 'clear-all-levels-twice';

export type AchievementProgress = Readonly<{
  id: AchievementId;
  title: string;
  description: string;
  progress: number;
  target: number;
  unlocked: boolean;
}>;

type LevelAchievementRecord = Readonly<{
  clears: number;
  bestGrade: RunGrade | null;
}>;

type AchievementRecords = Record<string, LevelAchievementRecord>;

const gradeRank: Record<RunGrade, number> = {
  C: 1,
  B: 2,
  A: 3,
  S: 4,
};

export function loadAchievementProgress(
  levelIds: readonly string[],
  storage: Storage | null = browserStorage(),
): readonly AchievementProgress[] {
  return buildAchievementProgress(levelIds, storage ? loadRecords(storage, levelIds) : {});
}

export function recordLevelAchievementClear(params: {
  levelId: string;
  grade: RunGrade;
  levelIds: readonly string[];
  storage?: Storage | null;
}): { progress: readonly AchievementProgress[]; unlocked: readonly AchievementProgress[] } {
  const storage = params.storage === undefined ? browserStorage() : params.storage;
  const records = storage ? loadRecords(storage, params.levelIds) : {};
  const before = buildAchievementProgress(params.levelIds, records);
  const previous = records[params.levelId];
  records[params.levelId] = {
    clears: Math.max(0, previous?.clears ?? 0) + 1,
    bestGrade: bestGrade(previous?.bestGrade ?? null, params.grade),
  };

  if (storage) {
    saveRecords(records, storage);
  }

  const progress = buildAchievementProgress(params.levelIds, records);
  const previouslyUnlocked = new Set(before.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id));
  const unlocked = progress.filter((achievement) => achievement.unlocked && !previouslyUnlocked.has(achievement.id));
  return { progress, unlocked };
}

function buildAchievementProgress(levelIds: readonly string[], records: AchievementRecords): readonly AchievementProgress[] {
  const totalLevels = levelIds.length;
  const clearedLevels = levelIds.filter((levelId) => (records[levelId]?.clears ?? 0) > 0).length;
  const sRankLevels = levelIds.filter((levelId) => records[levelId]?.bestGrade === 'S').length;
  const doubleClearProgress = levelIds.reduce((total, levelId) => total + Math.min(records[levelId]?.clears ?? 0, 2), 0);
  const cleanEntryProgress = sRankLevels > 0 ? 1 : 0;

  return [
    {
      id: 'complete-all-levels',
      title: 'Circuit Complete',
      description: 'Complete every level.',
      progress: clearedLevels,
      target: totalLevels,
      unlocked: totalLevels > 0 && clearedLevels >= totalLevels,
    },
    {
      id: 'clean-entry',
      title: 'Clean Entry',
      description: 'Earn an S grade on any level.',
      progress: cleanEntryProgress,
      target: 1,
      unlocked: cleanEntryProgress === 1,
    },
    {
      id: 's-rank-all-levels',
      title: 'Perfect Shadow',
      description: 'Earn an S grade on every level.',
      progress: sRankLevels,
      target: totalLevels,
      unlocked: totalLevels > 0 && sRankLevels >= totalLevels,
    },
    {
      id: 'clear-all-levels-twice',
      title: 'Second Sweep',
      description: 'Clear each level twice.',
      progress: doubleClearProgress,
      target: totalLevels * 2,
      unlocked: totalLevels > 0 && doubleClearProgress >= totalLevels * 2,
    },
  ];
}

function bestGrade(previous: RunGrade | null, next: RunGrade): RunGrade {
  return previous === null || gradeRank[next] > gradeRank[previous] ? next : previous;
}

function loadRecords(storage: Storage, levelIds: readonly string[]): AchievementRecords {
  try {
    const stored = storage.getItem(achievementsKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const knownLevelIds = new Set(levelIds);
    const records: AchievementRecords = {};
    for (const [levelId, value] of Object.entries(parsed)) {
      if (!knownLevelIds.has(levelId) || !value || typeof value !== 'object') continue;
      const candidate = value as Partial<LevelAchievementRecord>;
      const clears = typeof candidate.clears === 'number' && Number.isFinite(candidate.clears) ? Math.max(0, Math.floor(candidate.clears)) : 0;
      const bestGrade = isRunGrade(candidate.bestGrade) ? candidate.bestGrade : null;
      if (clears > 0 || bestGrade !== null) {
        records[levelId] = { clears, bestGrade };
      }
    }
    return records;
  } catch {
    return {};
  }
}

function saveRecords(records: AchievementRecords, storage: Storage): void {
  try {
    storage.setItem(achievementsKey, JSON.stringify(records));
  } catch {
    // Keep the current completion flow usable if browser storage is unavailable.
  }
}

function isRunGrade(value: unknown): value is RunGrade {
  return value === 'S' || value === 'A' || value === 'B' || value === 'C';
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
