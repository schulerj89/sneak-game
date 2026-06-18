import packageInfo from '../../package.json';

export type VersionedFeatureId = 'first-run-cinematic-tutorial';

export type VersionedFeature = Readonly<{
  id: VersionedFeatureId;
  introducedVersion: string;
}>;

export const versionedFeaturesStorageKey = 'shadow-circuit-versioned-features-v1';
export const firstRunCinematicTutorialFeature: VersionedFeature = {
  id: 'first-run-cinematic-tutorial',
  introducedVersion: '2.8.0',
};

type VersionedFeatureRecords = Partial<Record<VersionedFeatureId, string>>;

export function shouldShowVersionedFeature(
  feature: VersionedFeature,
  storage: Storage | null = browserStorage(),
  currentVersion = packageInfo.version,
): boolean {
  if (compareVersions(currentVersion, feature.introducedVersion) < 0) return false;
  if (!storage) return false;

  return loadVersionedFeatureRecords(storage)[feature.id] !== feature.introducedVersion;
}

export function markVersionedFeatureSeen(feature: VersionedFeature, storage: Storage | null = browserStorage()): void {
  if (!storage) return;

  const records = loadVersionedFeatureRecords(storage);
  records[feature.id] = feature.introducedVersion;
  try {
    storage.setItem(versionedFeaturesStorageKey, JSON.stringify(records));
  } catch {
    // Storage failures should not block play.
  }
}

export function clearVersionedFeatureRecords(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(versionedFeaturesStorageKey);
  } catch {
    // Storage failures should not block the settings action.
  }
}

export function loadVersionedFeatureRecords(storage: Storage): VersionedFeatureRecords {
  try {
    const stored = storage.getItem(versionedFeaturesStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const records: VersionedFeatureRecords = {};
    for (const [id, version] of Object.entries(parsed)) {
      if (isVersionedFeatureId(id) && typeof version === 'string') {
        records[id] = version;
      }
    }
    return records;
  } catch {
    return {};
  }
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }

  return 0;
}

function parseVersion(version: string): number[] {
  return version
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function isVersionedFeatureId(id: string): id is VersionedFeatureId {
  return id === 'first-run-cinematic-tutorial';
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
