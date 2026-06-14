import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.ENEMY_DEBUG_URL ?? 'http://127.0.0.1:5173/';
const outputDir = process.env.ENEMY_DEBUG_OUTPUT_DIR ?? 'artifacts';
const headless = process.env.ENEMY_DEBUG_HEADLESS !== 'false';

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

try {
  await mkdir(outputDir, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await page.selectOption('[data-setting="quality"]', 'cinematic');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();

  await selectLevel(0);
  await page.evaluate(() => {
    const debug = (window as DebugWindow).__shadowCircuitDebug;
    debug?.setEnemyDebugView(true);
    const hud = document.querySelector('[data-testid="hud"]');
    const debugPanel = document.querySelector('[data-testid="debug-panel"]');
    if (hud instanceof HTMLElement) hud.style.display = 'none';
    if (debugPanel instanceof HTMLElement) debugPanel.style.display = 'none';
  });
  await page.waitForTimeout(900);

  const start = await enemySentry();
  await page.screenshot({ path: `${outputDir}/enemy-debug-sentry-start.png`, fullPage: true });
  await page.waitForTimeout(2200);
  const forward = await enemySentry();
  await page.screenshot({ path: `${outputDir}/enemy-debug-sentry-forward.png`, fullPage: true });
  await page.waitForTimeout(3600);
  const turn = await enemySentry();
  await page.screenshot({ path: `${outputDir}/enemy-debug-sentry-turn.png`, fullPage: true });

  const samples: EnemySentryDebugState[] = [start, forward, turn];
  for (let index = 0; index < 12; index += 1) {
    await page.waitForTimeout(220);
    samples.push(await enemySentry());
  }

  assertState(samples.every((sample) => sample.id), `Expected enemy debug samples, got ${JSON.stringify(samples)}`);
  assertState(samples.every((sample) => sample.cinematic), `Expected cinematic enemy_sentry GLB, got ${JSON.stringify(samples.map((sample) => sample.meshName))}`);
  const meshYs = samples.map((sample) => requireNumber(sample.meshY, 'meshY'));
  const yRange = Math.max(...meshYs) - Math.min(...meshYs);
  assertState(yRange > 0.14, `Expected visible hover range > 0.14, got ${yRange.toFixed(3)}`);
  assertState(Math.min(...meshYs) > 0.56, `Expected sentry to hover above floor, got min Y ${Math.min(...meshYs).toFixed(3)}`);

  const movement = distance(requirePosition(start.position), requirePosition(turn.position));
  assertState(movement > 1.2, `Expected patrol movement > 1.2, got ${movement.toFixed(3)}`);

  const yawDeltas = samples.map((sample) => angleDistance(requireNumber(sample.yaw, 'yaw'), Math.atan2(requirePosition(sample.facing).x, requirePosition(sample.facing).z)));
  const lightDeltas = samples.map((sample) => vectorAngleDistance(requirePosition(sample.lightDirection), requirePosition(sample.facing)));
  const lightFrontOffsets = samples.map((sample) => requireNumber(sample.lightFrontOffset, 'lightFrontOffset'));
  const lightHeightOffsets = samples.map((sample) => requireNumber(sample.lightHeightOffset, 'lightHeightOffset'));
  assertState(Math.max(...yawDeltas) < 0.28, `Expected sentry yaw to match facing, got max delta ${Math.max(...yawDeltas).toFixed(3)}`);
  assertState(Math.max(...lightDeltas) < 0.18, `Expected spotlight direction to match facing, got max delta ${Math.max(...lightDeltas).toFixed(3)}`);
  assertState(Math.min(...lightFrontOffsets) > 0.26, `Expected spotlight origin in front of sentry, got min offset ${Math.min(...lightFrontOffsets).toFixed(3)}`);
  assertState(Math.min(...lightHeightOffsets) > 1.05, `Expected spotlight origin near top of sentry, got min height offset ${Math.min(...lightHeightOffsets).toFixed(3)}`);

  console.info(
    `[enemy-debug] ok cinematic=${samples[0].cinematic} movement=${movement.toFixed(3)} yRange=${yRange.toFixed(3)} maxYawDelta=${Math.max(...yawDeltas).toFixed(3)} maxLightDelta=${Math.max(...lightDeltas).toFixed(3)} minLightFrontOffset=${Math.min(...lightFrontOffsets).toFixed(3)} minLightHeightOffset=${Math.min(...lightHeightOffsets).toFixed(3)} screenshots=${outputDir}/enemy-debug-sentry-start.png, ${outputDir}/enemy-debug-sentry-forward.png, ${outputDir}/enemy-debug-sentry-turn.png`,
  );
} finally {
  await browser.close();
}

async function selectLevel(levelIndex: number): Promise<void> {
  await page.evaluate(async (targetLevelIndex) => {
    const debug = (window as DebugWindow).__shadowCircuitDebug;
    await debug?.selectLevel(targetLevelIndex);
  }, levelIndex);
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 10000 });
}

async function enemySentry(): Promise<EnemySentryDebugState> {
  return page.evaluate(() => {
    const state = (window as DebugWindow).__shadowCircuitDebug?.enemySentry();
    if (!state) throw new Error('Missing enemy sentry debug hook');
    return state;
  });
}

function requireNumber(value: number | null, label: string): number {
  if (typeof value !== 'number') throw new Error(`Missing ${label}`);
  return value;
}

function requirePosition(value: Vec2 | null): Vec2 {
  if (!value) throw new Error('Missing vector');
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleDistance(actual: number, expected: number): number {
  return Math.abs(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)));
}

function vectorAngleDistance(a: Vec2, b: Vec2): number {
  return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)));
}

function assertState(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type Vec2 = {
  x: number;
  z: number;
};

type EnemySentryDebugState = {
  id: string | null;
  cinematic: boolean;
  meshName: string | null;
  position: Vec2 | null;
  meshY: number | null;
  yaw: number | null;
  facing: Vec2 | null;
  lightDirection: Vec2 | null;
  lightFrontOffset: number | null;
  lightHeightOffset: number | null;
  debugCamera: boolean;
};

type DebugWindow = Window & {
  __shadowCircuitDebug?: {
    selectLevel: (index: number) => Promise<void>;
    setEnemyDebugView: (enabled: boolean) => void;
    enemySentry: () => EnemySentryDebugState;
  };
};
