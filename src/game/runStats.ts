import type { RunGrade, RunSummary } from './types';

export const runRecordsStorageKey = 'shadow-circuit-run-records-v1';

type RunRecord = Readonly<{
  bestTimeMs: number;
}>;

type RunRecords = Record<string, RunRecord>;

export type RunRecordProgress = Readonly<{
  levelId: string;
  bestTimeMs: number | null;
}>;

export function createRunSummary(params: {
  elapsedMs: number;
  parSeconds: number;
  alerts: number;
  previousBestTimeMs: number | null;
}): RunSummary {
  const elapsedMs = Math.max(0, Math.round(params.elapsedMs));
  const parSeconds = Math.max(1, params.parSeconds);
  const elapsedSeconds = elapsedMs / 1000;
  const overtimeSeconds = Math.max(0, elapsedSeconds - parSeconds);
  const score = Math.max(0, Math.round(1000 - overtimeSeconds * 8 - params.alerts * 140));

  return {
    elapsedMs,
    parSeconds,
    alerts: Math.max(0, params.alerts),
    score,
    grade: gradeRun(score, params.alerts, elapsedSeconds, parSeconds),
    bestTimeMs: params.previousBestTimeMs,
    isNewBest: params.previousBestTimeMs === null || elapsedMs < params.previousBestTimeMs,
  };
}

export function runDeltaLabel(summary: RunSummary): string {
  if (summary.bestTimeMs !== null) {
    const deltaMs = summary.elapsedMs - summary.bestTimeMs;
    if (deltaMs === 0) return 'Best even';
    return `Best ${deltaMs < 0 ? '-' : '+'}${formatRunTimeDelta(Math.abs(deltaMs))}`;
  }

  const deltaMs = summary.elapsedMs - summary.parSeconds * 1000;
  if (deltaMs === 0) return 'Par even';
  return `Par ${deltaMs < 0 ? '-' : '+'}${formatRunTimeDelta(Math.abs(deltaMs))}`;
}

export function loadBestTime(levelId: string, storage: Storage | null = browserStorage()): number | null {
  if (!storage) return null;

  const records = loadRecords(storage);
  return records[levelId]?.bestTimeMs ?? null;
}

export function loadRunRecordProgress(
  levelIds: readonly string[],
  storage: Storage | null = browserStorage(),
): readonly RunRecordProgress[] {
  const records = storage ? loadRecords(storage) : {};
  return levelIds.map((levelId) => ({
    levelId,
    bestTimeMs: records[levelId]?.bestTimeMs ?? null,
  }));
}

export function saveBestTime(levelId: string, elapsedMs: number, storage: Storage | null = browserStorage()): void {
  if (!storage) return;

  const records = loadRecords(storage);
  records[levelId] = { bestTimeMs: Math.max(0, Math.round(elapsedMs)) };
  try {
    storage.setItem(runRecordsStorageKey, JSON.stringify(records));
  } catch {
    // Safari can reject localStorage writes in private/quota-limited sessions.
  }
}

function loadRecords(storage: Storage): RunRecords {
  try {
    const stored = storage.getItem(runRecordsStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const records: RunRecords = {};
    for (const [levelId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const bestTimeMs = (value as Partial<RunRecord>).bestTimeMs;
      if (typeof bestTimeMs === 'number' && Number.isFinite(bestTimeMs) && bestTimeMs >= 0) {
        records[levelId] = { bestTimeMs };
      }
    }
    return records;
  } catch {
    return {};
  }
}

function formatRunTimeDelta(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function gradeRun(score: number, alerts: number, elapsedSeconds: number, parSeconds: number): RunGrade {
  if (alerts === 0 && elapsedSeconds <= parSeconds) return 'S';
  if (score >= 850) return 'A';
  if (score >= 700) return 'B';
  return 'C';
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
