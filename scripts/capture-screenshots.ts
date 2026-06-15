import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:5173/';
const outputDir = 'docs/images';
const headless = process.env.SCREENSHOT_HEADLESS === 'true';

const levelShots = [
  { index: 0, file: 'shadow-circuit-level-1-dock-blackout.png' },
  { index: 1, file: 'shadow-circuit-level-2-archive-lanes.png' },
  { index: 2, file: 'shadow-circuit-level-3-reactor-core.png' },
  { index: 3, file: 'shadow-circuit-level-4-neon-atrium.png' },
  { index: 4, file: 'shadow-circuit-level-5-signal-vault.png' },
  { index: 5, file: 'shadow-circuit-level-6-transit-switchyard.png' },
  { index: 6, file: 'shadow-circuit-level-7-mirror-lab.png' },
  { index: 7, file: 'shadow-circuit-level-8-command-spire.png' },
  { index: 8, file: 'shadow-circuit-level-9-service-gallery.png' },
  { index: 9, file: 'shadow-circuit-level-10-cooling-ducts.png' },
  { index: 10, file: 'shadow-circuit-level-11-datacore-maze.png' },
  { index: 11, file: 'shadow-circuit-level-12-blackout-crown.png' },
] as const;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

try {
  await mkdir(outputDir, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).waitFor({ state: 'visible', timeout: 8000 });

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-setting="soundtrack"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.selectOption('[data-setting="quality"]', 'cinematic');
  await page.screenshot({ path: `${outputDir}/shadow-circuit-settings.png`, fullPage: true });
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Levels' }).click();
  await page.locator('[data-level-index="11"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: `${outputDir}/shadow-circuit-level-select.png`, fullPage: true });

  await selectLevel(0);
  await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -1.8, z: -2.8 });
    const hud = document.querySelector('[data-testid="hud"]');
    const debugPanel = document.querySelector('[data-testid="debug-panel"]');
    if (hud instanceof HTMLElement) hud.style.display = 'none';
    if (debugPanel instanceof HTMLElement) debugPanel.style.display = 'none';
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outputDir}/shadow-circuit-characters.png`, fullPage: true });
  await page.evaluate(() => {
    const hud = document.querySelector('[data-testid="hud"]');
    const debugPanel = document.querySelector('[data-testid="debug-panel"]');
    if (hud instanceof HTMLElement) hud.style.display = '';
    if (debugPanel instanceof HTMLElement) debugPanel.style.display = '';
  });

  for (const shot of levelShots) {
    await selectLevel(shot.index);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outputDir}/${shot.file}`, fullPage: true });
  }

  console.info(`[screenshots] wrote ${levelShots.length + 3} screenshots to ${outputDir}`);
} finally {
  await browser.close();
}

async function selectLevel(levelIndex: number): Promise<void> {
  await page.evaluate(async (targetLevelIndex) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectLevel: (index: number) => Promise<void>;
      };
    };
    await debugWindow.__shadowCircuitDebug?.selectLevel(targetLevelIndex);
  }, levelIndex);
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
}
