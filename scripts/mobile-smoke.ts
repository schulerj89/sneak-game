import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const baseUrl = process.env.MOBILE_SMOKE_URL ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/';
const screenshotDir = 'artifacts';
const headless = process.env.MOBILE_SMOKE_HEADLESS === 'true';

const browser = await chromium.launch({
  headless,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

try {
  await mkdir(screenshotDir, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await expectVisible(page, '[data-testid="overlay"]');

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Run' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await expectVisible(page, '[data-testid="character-select-panel"]');

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  await expectVisible(page, '[data-testid="briefing-panel"]');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await assertPlayingPhase(page);

  await expectVisible(page, '[data-testid="touch-controls"]');
  await assertTouchLayout(page);

  const before = await playerPosition(page);
  const padBox = await page.locator('[data-testid="touch-pad"]').boundingBox();
  if (!padBox) {
    throw new Error('Touch pad is missing a layout box');
  }

  const centerX = padBox.x + padBox.width / 2;
  const centerY = padBox.y + padBox.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + padBox.width * 0.35, centerY, { steps: 6 });
  await page.waitForTimeout(650);
  await page.mouse.up();

  const after = await playerPosition(page);
  if (after.x <= before.x + 0.25) {
    throw new Error(`Expected joystick drag to move player right: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }

  const stickOffset = await page.locator('[data-testid="touch-pad"]').evaluate((element) => ({
    x: (element as HTMLElement).style.getPropertyValue('--stick-x'),
    y: (element as HTMLElement).style.getPropertyValue('--stick-y'),
  }));
  if (stickOffset.x !== '0px' || stickOffset.y !== '0px') {
    throw new Error(`Expected joystick to recenter after release, got ${JSON.stringify(stickOffset)}`);
  }

  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-mobile-touch.png`, fullPage: true });

  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Menu' }).click();
  await page.locator('[data-testid="touch-controls"]').waitFor({ state: 'hidden', timeout: 8000 });

  console.info(`[mobile-smoke] ok url=${baseUrl}`);
  console.info(`[mobile-smoke] screenshot=${screenshotDir}/shadow-circuit-mobile-touch.png`);
} finally {
  await context.close();
  await browser.close();
}

async function expectVisible(page: Page, selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout: 12000 });
}

async function assertPlayingPhase(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase() === 'playing';
  }, undefined, { timeout: 22000 });
}

async function playerPosition(page: Page): Promise<{ x: number; z: number }> {
  const position = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        playerPosition: () => { x: number; z: number };
      };
    };
    return debugWindow.__shadowCircuitDebug?.playerPosition();
  });
  if (!position) {
    throw new Error('Debug player position was unavailable');
  }
  return position;
}

async function assertTouchLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const touchElement = document.querySelector('[data-testid="touch-controls"]');
    const debugElement = document.querySelector('[data-testid="debug-panel"]');
    const hudElement = document.querySelector('[data-testid="hud"]');
    const touch =
      touchElement instanceof HTMLElement && !touchElement.hidden && window.getComputedStyle(touchElement).display !== 'none'
        ? touchElement.getBoundingClientRect()
        : null;
    const debug =
      debugElement instanceof HTMLElement && !debugElement.hidden && window.getComputedStyle(debugElement).display !== 'none'
        ? debugElement.getBoundingClientRect()
        : null;
    const hud =
      hudElement instanceof HTMLElement && !hudElement.hidden && window.getComputedStyle(hudElement).display !== 'none'
        ? hudElement.getBoundingClientRect()
        : null;
    const overlapsDebug = Boolean(
      touch && debug && touch.left < debug.right && touch.right > debug.left && touch.top < debug.bottom && touch.bottom > debug.top,
    );
    const overlapsHud = Boolean(
      touch && hud && touch.left < hud.right && touch.right > hud.left && touch.top < hud.bottom && touch.bottom > hud.top,
    );

    return {
      touch: touch ? { left: touch.left, top: touch.top, width: touch.width, height: touch.height } : null,
      overlapsDebug,
      overlapsHud,
    };
  });

  if (!layout.touch || layout.touch.width < 110 || layout.touch.height < 110 || layout.overlapsDebug || layout.overlapsHud) {
    throw new Error(`Unexpected mobile touch layout: ${JSON.stringify(layout)}`);
  }
}
