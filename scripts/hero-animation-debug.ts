import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.HERO_DEBUG_URL ?? 'http://127.0.0.1:5173/';
const outputDir = process.env.HERO_DEBUG_OUTPUT_DIR ?? 'artifacts';
const headless = process.env.HERO_DEBUG_HEADLESS !== 'false';
const expectedRightYaw = Math.PI / 2;

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
    debug?.movePlayerTo({ x: -1.8, z: -2.8 });
    debug?.setHeroDebugView(true);
    const hud = document.querySelector('[data-testid="hud"]');
    const debugPanel = document.querySelector('[data-testid="debug-panel"]');
    if (hud instanceof HTMLElement) hud.style.display = 'none';
    if (debugPanel instanceof HTMLElement) debugPanel.style.display = 'none';
  });
  await page.waitForTimeout(900);

  const idle = await heroAnimation();
  assertState(idle.activeState === 'idle', `Expected idle animation, got ${JSON.stringify(idle)}`);
  assertState(idle.clipNames.some((name) => /idle/i.test(name)), `Expected idle clip in ${idle.clipNames.join(', ')}`);
  assertState(idle.clipNames.some((name) => /run_?02/i.test(name)), `Expected Run_02 clip in ${idle.clipNames.join(', ')}`);
  assertState(!idle.clipNames.some((name) => /run_?03/i.test(name)), `Run_03 clip should not be loaded: ${idle.clipNames.join(', ')}`);
  assertState(!idle.clipNames.some((name) => /walking/i.test(name)), `Walking clip should not be loaded: ${idle.clipNames.join(', ')}`);
  await page.screenshot({ path: `${outputDir}/hero-debug-idle.png`, fullPage: true });

  await page.keyboard.down('d');
  await page.waitForTimeout(950);
  const running = await heroAnimation();
  await page.screenshot({ path: `${outputDir}/hero-debug-running-right.png`, fullPage: true });
  assertState(running.activeState === 'run', `Expected run animation, got ${JSON.stringify(running)}`);
  assertYawNear(running.yaw, expectedRightYaw);

  await page.keyboard.up('d');
  await page.waitForTimeout(650);
  const returnedIdle = await heroAnimation();
  await page.screenshot({ path: `${outputDir}/hero-debug-return-idle.png`, fullPage: true });
  assertState(returnedIdle.activeState === 'idle', `Expected return to idle, got ${JSON.stringify(returnedIdle)}`);

  console.info(
    `[hero-debug] ok idle=${JSON.stringify(idle)} running=${JSON.stringify(running)} returned=${JSON.stringify(returnedIdle)} screenshots=${outputDir}/hero-debug-idle.png, ${outputDir}/hero-debug-running-right.png, ${outputDir}/hero-debug-return-idle.png`,
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

async function heroAnimation(): Promise<HeroAnimationDebugState> {
  return page.evaluate(() => {
    const state = (window as DebugWindow).__shadowCircuitDebug?.heroAnimation();
    if (!state) throw new Error('Missing hero animation debug hook');
    return state;
  });
}

function assertState(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertYawNear(actual: number, expected: number): void {
  const delta = Math.abs(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)));
  if (delta > 0.35) {
    throw new Error(`Expected hero yaw near ${expected.toFixed(2)}, got ${actual.toFixed(2)} (delta ${delta.toFixed(2)})`);
  }
}

type HeroAnimationDebugState = {
  activeState: string | null;
  clipNames: readonly string[];
  yaw: number;
  debugCamera: boolean;
};

type DebugWindow = Window & {
  __shadowCircuitDebug?: {
    selectLevel: (index: number) => Promise<void>;
    movePlayerTo: (point: { x: number; z: number }) => void;
    setHeroDebugView: (enabled: boolean) => void;
    heroAnimation: () => HeroAnimationDebugState;
  };
};
