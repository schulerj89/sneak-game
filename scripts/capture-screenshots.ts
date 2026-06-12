import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:5173/';
const outputDir = 'docs/images';
const headless = process.env.SCREENSHOT_HEADLESS !== 'false';

const levelShots = [
  { index: 0, file: 'shadow-circuit-level-1-dock-blackout.png' },
  { index: 1, file: 'shadow-circuit-level-2-archive-lanes.png' },
  { index: 2, file: 'shadow-circuit-level-3-reactor-core.png' },
  { index: 3, file: 'shadow-circuit-level-4-neon-atrium.png' },
  { index: 4, file: 'shadow-circuit-level-5-signal-vault.png' },
] as const;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

try {
  await mkdir(outputDir, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-setting="soundtrack"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: `${outputDir}/shadow-circuit-settings.png`, fullPage: true });
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Level Select' }).click();
  await page.locator('[data-level-index="4"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.screenshot({ path: `${outputDir}/shadow-circuit-level-select.png`, fullPage: true });

  for (const shot of levelShots) {
    await page.evaluate((levelIndex) => {
      const debugWindow = window as Window & {
        __shadowCircuitDebug?: {
          selectLevel: (index: number) => void;
        };
      };
      debugWindow.__shadowCircuitDebug?.selectLevel(levelIndex);
    }, shot.index);
    await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outputDir}/${shot.file}`, fullPage: true });
  }

  console.info(`[screenshots] wrote ${levelShots.length + 2} screenshots to ${outputDir}`);
} finally {
  await browser.close();
}
