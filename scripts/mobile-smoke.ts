import { mkdir } from 'node:fs/promises';
import { chromium, webkit, type Page } from 'playwright';
import packageInfo from '../package.json';
import { levels } from '../src/game/levels';

const baseUrl = process.env.MOBILE_SMOKE_URL ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/';
const screenshotDir = 'artifacts';
const headless = process.env.MOBILE_SMOKE_HEADLESS === 'true';
const browserName = process.env.MOBILE_SMOKE_BROWSER ?? 'chromium';
const playingTimeoutMs = Number(process.env.MOBILE_SMOKE_PLAYING_TIMEOUT_MS ?? 45000);
const expectedVersionLabel = `v${packageInfo.version}`;
const emulateIos = process.env.MOBILE_SMOKE_IOS === 'true' || browserName === 'webkit';
const iphoneUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

if (browserName !== 'chromium' && browserName !== 'webkit') {
  throw new Error(`Unsupported MOBILE_SMOKE_BROWSER=${browserName}`);
}

const browser = await (browserName === 'webkit' ? webkit : chromium).launch(
  browserName === 'chromium'
    ? {
        headless,
        args: [
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
        ],
      }
    : { headless },
);
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  userAgent: emulateIos ? iphoneUserAgent : undefined,
});
const page = await context.newPage();
const pageErrors: string[] = [];
page.on('pageerror', (error) => {
  pageErrors.push(error instanceof Error ? error.stack ?? error.message : String(error));
});

try {
  await mkdir(screenshotDir, { recursive: true });
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // Storage can be unavailable in Safari private/quota-limited sessions.
    }
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await expectVisible(page, '[data-testid="overlay"]');
  await assertVersionBadge(page);
  await expectVisible(page, '[data-testid="orientation-reminder"]');
  await assertDefaultDebugHidden(page);
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-mobile-portrait-rotate.png`, fullPage: true });

  await page.setViewportSize({ width: 932, height: 430 });
  await page.locator('[data-testid="orientation-reminder"]').waitFor({ state: 'hidden', timeout: 8000 });
  await assertVersionBadge(page);
  await assertActionButtonsFit(page, '[data-testid="overlay"]');
  await assertMobileGoalsPanel(page);
  await assertCompactMobileSettings(page);

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Run' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await expectVisible(page, '[data-testid="character-select-panel"]');
  await expectVisible(page, '[data-testid="hero-picker"]');
  await assertCharacterPicker(page, 'shadow-operative');
  await assertActionButtonsFit(page, '[data-testid="character-select-panel"]');
  await page.locator('[data-action="next-hero"]').click();
  await page.waitForFunction(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { selectedHero: () => string } };
    return debugWindow.__shadowCircuitDebug?.selectedHero() === 'echo-vanguard';
  }, undefined, { timeout: 8000 });
  await assertCharacterPicker(page, 'echo-vanguard');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-mobile-character-select.png`, fullPage: true });

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  await expectVisible(page, '[data-testid="briefing-panel"]');
  await assertMobileBriefingSimplified(page);
  await assertActionButtonsFit(page, '[data-testid="briefing-panel"]');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await assertPlayingPhase(page);

  await expectVisible(page, '[data-testid="touch-controls"]');
  await assertDefaultDebugHidden(page);
  await assertHudButtonsFit(page);
  await assertTouchLayout(page);
  await assertMobileIntelPulse(page);

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

  await completeDockAndAdvance(page);
  await completeCurrentLevelAndAdvance(page, 1, levels[2]?.id ?? 'reactor-core');
  if (pageErrors.length > 0) {
    throw new Error(`Unexpected page error(s): ${pageErrors.join('\n')}`);
  }

  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Menu' }).click();
  await page.locator('[data-testid="touch-controls"]').waitFor({ state: 'hidden', timeout: 8000 });

  console.info(`[mobile-smoke] ok browser=${browserName} url=${baseUrl}`);
  console.info(`[mobile-smoke] screenshots=${screenshotDir}/shadow-circuit-mobile-portrait-rotate.png, ${screenshotDir}/shadow-circuit-mobile-character-select.png, ${screenshotDir}/shadow-circuit-mobile-touch.png`);
} catch (error) {
  const diagnostics = await collectDiagnostics(page, pageErrors).catch((diagnosticError: unknown) => ({
    diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
    pageErrors,
  }));
  console.error(`[mobile-smoke] diagnostics=${JSON.stringify(diagnostics)}`);
  throw error;
} finally {
  await context.close();
  await browser.close();
}

async function expectVisible(page: Page, selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout: 12000 });
}

async function assertVersionBadge(page: Page): Promise<void> {
  await expectVisible(page, '[data-testid="app-version"]');
  const layout = await page.locator('[data-testid="app-version"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      text: element.textContent?.trim() ?? '',
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  if (
    layout.text !== expectedVersionLabel ||
    layout.left < 0 ||
    layout.top < 0 ||
    layout.right > layout.viewport.width ||
    layout.bottom > layout.viewport.height
  ) {
    throw new Error(`Expected visible mobile version badge ${expectedVersionLabel}, got ${JSON.stringify(layout)}`);
  }
}

async function assertPlayingPhase(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase() === 'playing';
  }, undefined, { timeout: playingTimeoutMs });
}

async function collectDiagnostics(page: Page, pageErrors: readonly string[]): Promise<Record<string, unknown>> {
  const appState = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="overlay"]');
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        levelId: () => string;
        loadingProgress: () => { value: number; label: string };
        selectedHero: () => string;
        memorySafeAssets: () => boolean;
      };
    };
    return {
      href: window.location.href,
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      loadingProgress: debugWindow.__shadowCircuitDebug?.loadingProgress(),
      selectedHero: debugWindow.__shadowCircuitDebug?.selectedHero(),
      memorySafeAssets: debugWindow.__shadowCircuitDebug?.memorySafeAssets(),
      overlayText: overlay?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 600) ?? '',
    };
  });

  return { ...appState, pageErrors };
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

  if (!layout.touch || layout.touch.width < 96 || layout.touch.height < 96 || layout.overlapsDebug || layout.overlapsHud) {
    throw new Error(`Unexpected mobile touch layout: ${JSON.stringify(layout)}`);
  }
}

async function assertDefaultDebugHidden(page: Page): Promise<void> {
  await page.locator('[data-testid="debug-panel"]').waitFor({ state: 'hidden', timeout: 8000 });
  const debugHidden = await page.locator('[data-testid="debug-panel"]').evaluate((element) => {
    const htmlElement = element as HTMLElement;
    return htmlElement.hidden || window.getComputedStyle(htmlElement).display === 'none';
  });
  if (!debugHidden) {
    throw new Error('Expected debug panel to be hidden by default');
  }
}

async function assertHudButtonsFit(page: Page): Promise<void> {
  const layout = await page.locator('[data-testid="hud"]').evaluate((hud) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const buttons = [...hud.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        label: button.textContent?.trim() ?? '',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    return { viewport, buttons };
  });

  const clipped = layout.buttons.filter(
    (button) =>
      button.left < 0 ||
      button.top < 0 ||
      button.right > layout.viewport.width ||
      button.bottom > layout.viewport.height,
  );
  if (clipped.length > 0) {
    throw new Error(`Expected HUD buttons to fit in landscape viewport: ${JSON.stringify({ ...layout, clipped })}`);
  }
}

async function assertMobileIntelPulse(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="intel-pulse-dock"]');
    const touch = document.querySelector('[data-testid="touch-controls"]');
    const button = dock?.querySelector('button');
    const dockRect = dock instanceof HTMLElement ? dock.getBoundingClientRect() : null;
    const buttonRect = button instanceof HTMLElement ? button.getBoundingClientRect() : null;
    const touchRect = touch instanceof HTMLElement ? touch.getBoundingClientRect() : null;
    const copy = dock?.querySelector('.intel-pulse-copy');
    const copyStyle = copy instanceof HTMLElement ? window.getComputedStyle(copy) : null;

    return {
      dock: dockRect
        ? { left: dockRect.left, right: dockRect.right, top: dockRect.top, bottom: dockRect.bottom, width: dockRect.width, height: dockRect.height }
        : null,
      button: buttonRect
        ? { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom, width: buttonRect.width, height: buttonRect.height }
        : null,
      touch: touchRect ? { left: touchRect.left, right: touchRect.right, top: touchRect.top, bottom: touchRect.bottom } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      copyVisible: Boolean(copyStyle && copyStyle.display !== 'none' && copyStyle.visibility !== 'hidden'),
    };
  });
  const overlapsTouch = Boolean(
    layout.dock &&
      layout.touch &&
      layout.dock.left < layout.touch.right &&
      layout.dock.right > layout.touch.left &&
      layout.dock.top < layout.touch.bottom &&
      layout.dock.bottom > layout.touch.top,
  );

  if (
    !layout.dock ||
    !layout.button ||
    layout.button.width < 50 ||
    layout.button.height < 50 ||
    layout.dock.left < 0 ||
    layout.dock.top < 0 ||
    layout.dock.right > layout.viewport.width ||
    layout.dock.bottom > layout.viewport.height ||
    layout.copyVisible ||
    overlapsTouch
  ) {
    throw new Error(`Expected compact mobile intel pulse dock away from joystick, got ${JSON.stringify({ ...layout, overlapsTouch })}`);
  }

  await page.locator('[data-testid="intel-pulse-dock"]').getByRole('button', { name: 'Mission Intel Pulse' }).click();
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        intelPulse: () => {
          active: boolean;
          charges: number;
          mobileSimplified: boolean;
          objectiveTargets: number;
          exitTargets: number;
          patrolRoutes: number;
          waypointTargets: number;
        };
      };
    };
    const state = debugWindow.__shadowCircuitDebug?.intelPulse();
    return Boolean(
      state?.active &&
        state.charges === 2 &&
        state.mobileSimplified &&
        state.objectiveTargets > 0 &&
        state.exitTargets === 1 &&
        state.patrolRoutes === 0 &&
        state.waypointTargets === 0,
    );
  }, undefined, { timeout: 8000 });
}

async function assertActionButtonsFit(page: Page, containerSelector: string): Promise<void> {
  const layout = await page.locator(containerSelector).evaluate((container) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const buttons = [...container.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        label: button.textContent?.trim() ?? '',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    return { viewport, buttons };
  });

  const clipped = layout.buttons.filter(
    (button) =>
      button.left < 0 ||
      button.top < 0 ||
      button.right > layout.viewport.width ||
      button.bottom > layout.viewport.height,
  );
  if (clipped.length > 0) {
    throw new Error(`Expected ${containerSelector} buttons to fit in landscape viewport: ${JSON.stringify({ ...layout, clipped })}`);
  }
}

async function assertMobileGoalsPanel(page: Page): Promise<void> {
  const inlineAchievementSummaryCount = await page.locator('[data-testid="achievement-summary"]').count();
  if (inlineAchievementSummaryCount !== 0) {
    throw new Error(`Expected mobile title screen to keep goals separate, found ${inlineAchievementSummaryCount} inline summaries`);
  }

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Goals' }).click();
  await expectVisible(page, '[data-testid="goals-panel"]');
  await assertActionButtonsFit(page, '[data-testid="goals-panel"]');

  const state = await page.locator('[data-testid="goals-panel"]').evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const summary = panel.querySelector('[data-testid="achievement-summary"]');
    if (!(summary instanceof HTMLElement)) {
      return {
        count: 0,
        descriptionVisible: false,
        panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom },
        summary: null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        text: '',
      };
    }

    const summaryRect = summary.getBoundingClientRect();
    const cards = [...summary.querySelectorAll('[data-achievement-id]')];
    const descriptionVisible = cards.some((card) => {
      const description = card.querySelector('.achievement-card-copy span');
      if (!(description instanceof HTMLElement)) return false;

      const rect = description.getBoundingClientRect();
      const style = window.getComputedStyle(description);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });

    return {
      count: cards.length,
      descriptionVisible,
      panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom },
      summary: { left: summaryRect.left, right: summaryRect.right, top: summaryRect.top, bottom: summaryRect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      text: summary.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });

  if (
    state.count !== 3 ||
    state.descriptionVisible ||
    !state.text.includes('Circuit Complete') ||
    !state.text.includes('Perfect Shadow') ||
    !state.text.includes('Second Sweep') ||
    state.panel.left < 0 ||
    state.panel.top < 0 ||
    state.panel.right > state.viewport.width ||
    state.panel.bottom > state.viewport.height ||
    state.summary === null ||
    state.summary.left < 0 ||
    state.summary.top < 0 ||
    state.summary.right > state.viewport.width ||
    state.summary.bottom > state.viewport.height
  ) {
    throw new Error(`Expected compact mobile goals panel, got ${JSON.stringify(state)}`);
  }

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await expectVisible(page, 'text=Move unseen through the facility');
}

async function assertMobileBriefingSimplified(page: Page): Promise<void> {
  const state = await page.locator('[data-testid="briefing-panel"]').evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const mobileCopy = panel.querySelector('.mobile-briefing-copy');
    const grid = panel.querySelector('.briefing-grid');
    const mobileCopyRect = mobileCopy instanceof HTMLElement ? mobileCopy.getBoundingClientRect() : null;
    const gridRect = grid instanceof HTMLElement ? grid.getBoundingClientRect() : null;
    const mobileCopyStyle = mobileCopy instanceof HTMLElement ? window.getComputedStyle(mobileCopy) : null;
    const gridStyle = grid instanceof HTMLElement ? window.getComputedStyle(grid) : null;

    return {
      panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      text: mobileCopy?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      mobileCopyVisible: Boolean(
        mobileCopyStyle &&
          mobileCopyStyle.display !== 'none' &&
          mobileCopyStyle.visibility !== 'hidden' &&
          mobileCopyRect &&
          mobileCopyRect.width > 0 &&
          mobileCopyRect.height > 0,
      ),
      gridVisible: Boolean(
        gridStyle &&
          gridStyle.display !== 'none' &&
          gridStyle.visibility !== 'hidden' &&
          gridRect &&
          gridRect.width > 0 &&
          gridRect.height > 0,
      ),
    };
  });

  if (
    !state.mobileCopyVisible ||
    state.gridVisible ||
    !state.text.includes('keycards and terminals') ||
    !state.text.includes('exit turns green') ||
    state.panel.left < 0 ||
    state.panel.top < 0 ||
    state.panel.right > state.viewport.width ||
    state.panel.bottom > state.viewport.height
  ) {
    throw new Error(`Expected simplified mobile briefing, got ${JSON.stringify(state)}`);
  }
}

async function assertCompactMobileSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await expectVisible(page, 'text=Render quality');

  const layout = await page.evaluate(() => {
    const panel = document.querySelector('.settings-panel');
    const panelRect = panel instanceof HTMLElement ? panel.getBoundingClientRect() : null;
    const soundtrackSelect = document.querySelector('[data-setting="soundtrack"]');
    const soundtrackLabel = soundtrackSelect?.closest('label') ?? null;
    const note = document.querySelector('.settings-note');
    const soundtrackSelectStyle = soundtrackSelect instanceof HTMLElement ? window.getComputedStyle(soundtrackSelect) : null;
    const soundtrackLabelStyle = soundtrackLabel instanceof HTMLElement ? window.getComputedStyle(soundtrackLabel) : null;
    const noteStyle = note instanceof HTMLElement ? window.getComputedStyle(note) : null;
    const soundtrackSelectRect = soundtrackSelect instanceof HTMLElement ? soundtrackSelect.getBoundingClientRect() : null;
    const soundtrackLabelRect = soundtrackLabel instanceof HTMLElement ? soundtrackLabel.getBoundingClientRect() : null;
    const noteRect = note instanceof HTMLElement ? note.getBoundingClientRect() : null;

    return {
      panel: panelRect
        ? {
            left: panelRect.left,
            right: panelRect.right,
            top: panelRect.top,
            bottom: panelRect.bottom,
            height: panelRect.height,
          }
        : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      soundtrackSelectVisible: Boolean(
        soundtrackSelectStyle &&
          soundtrackSelectStyle.display !== 'none' &&
          soundtrackSelectStyle.visibility !== 'hidden' &&
          soundtrackSelectRect &&
          soundtrackSelectRect.width > 0 &&
          soundtrackSelectRect.height > 0,
      ),
      soundtrackLabelVisible: Boolean(
        soundtrackLabelStyle &&
          soundtrackLabelStyle.display !== 'none' &&
          soundtrackLabelStyle.visibility !== 'hidden' &&
          soundtrackLabelRect &&
          soundtrackLabelRect.width > 0 &&
          soundtrackLabelRect.height > 0,
      ),
      noteVisible: Boolean(
        noteStyle &&
          noteStyle.display !== 'none' &&
          noteStyle.visibility !== 'hidden' &&
          noteRect &&
          noteRect.width > 0 &&
          noteRect.height > 0,
      ),
    };
  });

  if (
    !layout.panel ||
    layout.panel.left < 0 ||
    layout.panel.top < 0 ||
    layout.panel.right > layout.viewport.width ||
    layout.panel.bottom > layout.viewport.height ||
    layout.soundtrackSelectVisible ||
    layout.soundtrackLabelVisible ||
    layout.noteVisible
  ) {
    throw new Error(`Expected compact mobile settings without soundtrack controls, got ${JSON.stringify(layout)}`);
  }

  await assertActionButtonsFit(page, '.settings-panel');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await expectVisible(page, 'text=Move unseen through the facility');
}

async function assertCharacterPicker(page: Page, expectedHeroId: string): Promise<void> {
  await page.waitForFunction((heroId) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectedHero: () => string;
        titleHero: () => {
          visible: boolean;
          inCamera: boolean;
          cinematic: boolean;
          activeState: string | null;
          x: number | null;
          screen: { x: number; y: number } | null;
        };
        heroAssetQuality: () => string;
        loadedHeroAssets: () => readonly string[];
      };
    };
    const debug = debugWindow.__shadowCircuitDebug;
    const titleHero = debug?.titleHero();
    const expectsCinematic = debug?.heroAssetQuality() === 'cinematic';
    const loadedHeroes = new Set<string>(debug?.loadedHeroAssets() ?? []);
    const selectedHeroLoaded = !expectsCinematic || loadedHeroes.has(heroId);
    return Boolean(
      debug?.selectedHero() === heroId &&
        titleHero?.visible &&
        titleHero.x !== null &&
        titleHero.screen !== null &&
        titleHero.screen.y > 185 &&
        titleHero.screen.y < 250 &&
        selectedHeroLoaded &&
        (!expectsCinematic || (titleHero.cinematic && titleHero.activeState === 'idle')),
    );
  }, expectedHeroId, { timeout: 22000 });

  const state = await page.evaluate(() => {
    const picker = document.querySelector('[data-testid="hero-picker"]');
    const pickerStyle = picker ? window.getComputedStyle(picker) : null;
    const grid = document.querySelector('.hero-grid');
    const gridStyle = grid ? window.getComputedStyle(grid) : null;
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectedHero: () => string;
        titleHero: () => {
          visible: boolean;
          inCamera: boolean;
          cinematic: boolean;
          activeState: string | null;
          x: number | null;
          y: number | null;
          screen: { x: number; y: number } | null;
        };
        memorySafeAssets: () => boolean;
        runtimeQuality: () => string;
        heroAssetQuality: () => string;
        enemyAssetQuality: () => string;
        loadedHeroAssets: () => readonly string[];
      };
    };
    return {
      pickerVisible: pickerStyle?.display !== 'none',
      pickerText: picker?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      gridHidden: gridStyle?.display === 'none',
      selectedHero: debugWindow.__shadowCircuitDebug?.selectedHero(),
      titleHero: debugWindow.__shadowCircuitDebug?.titleHero(),
      memorySafeAssets: debugWindow.__shadowCircuitDebug?.memorySafeAssets(),
      runtimeQuality: debugWindow.__shadowCircuitDebug?.runtimeQuality(),
      heroAssetQuality: debugWindow.__shadowCircuitDebug?.heroAssetQuality(),
      enemyAssetQuality: debugWindow.__shadowCircuitDebug?.enemyAssetQuality(),
      loadedHeroAssets: debugWindow.__shadowCircuitDebug?.loadedHeroAssets() ?? [],
    };
  });
  const expectedCinematic = state.heroAssetQuality === 'cinematic';
  const loadedHeroes = new Set<string>(state.loadedHeroAssets);
  const selectedHeroLoaded = !expectedCinematic || loadedHeroes.has(expectedHeroId);

  if (
    !state.pickerVisible ||
    !state.gridHidden ||
    !selectedHeroLoaded ||
    state.selectedHero !== expectedHeroId ||
    !state.titleHero?.visible ||
    !state.titleHero.inCamera ||
    state.titleHero.cinematic !== expectedCinematic ||
    (expectedCinematic && state.titleHero.activeState !== 'idle') ||
    (state.memorySafeAssets === true && (state.runtimeQuality !== 'memory' || state.enemyAssetQuality !== 'memory')) ||
    state.titleHero.x === null ||
    Math.abs(state.titleHero.x - 1.35) > 0.08 ||
    state.titleHero.screen === null ||
    state.titleHero.screen.y < 185 ||
    state.titleHero.screen.y > 250
  ) {
    throw new Error(`Expected compact character picker for ${expectedHeroId}, got ${JSON.stringify(state)}`);
  }
}

async function completeDockAndAdvance(page: Page): Promise<void> {
  await movePlayerTo(page, { x: -1.0, z: -1.2 });
  await assertObjectiveNoticeHidden(page);
  await movePlayerTo(page, { x: 2.4, z: -3.4 });
  await assertObjectiveNoticeHidden(page);
  await movePlayerTo(page, { x: 5, z: -3.2 });
  await page.evaluate(() => {
    document.querySelector('[data-testid="overlay"]')?.scrollIntoView({ block: 'center', inline: 'center' });
  });
  await expectVisible(page, 'text=Exit Reached');
  await assertActionButtonsFit(page, '[data-testid="overlay"]');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Next Level' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await assertPlayingPhase(page);

  const levelState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelId: () => string;
        phase: () => string;
      };
    };
    return {
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      phase: debugWindow.__shadowCircuitDebug?.phase(),
    };
  });

  if (levelState.levelId !== 'archive-lanes' || levelState.phase !== 'playing') {
    throw new Error(`Expected Next Level to enter Archive Lanes without reset, got ${JSON.stringify(levelState)}`);
  }
}

async function movePlayerTo(page: Page, point: { x: number; z: number }): Promise<void> {
  await page.evaluate((target) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.movePlayerTo(target);
  }, point);
}

async function assertObjectiveNoticeHidden(page: Page): Promise<void> {
  const visible = await page.evaluate(() => {
    const notice = document.querySelector('.objective-notice');
    if (!(notice instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(notice);
    return style.display !== 'none' && style.visibility !== 'hidden' && Boolean(notice.textContent?.trim());
  });
  if (visible) {
    throw new Error('Expected mobile objective pickup notice to stay hidden');
  }
}

async function completeCurrentLevelAndAdvance(page: Page, levelIndex: number, expectedNextLevelId: string): Promise<void> {
  const level = levels[levelIndex];
  if (!level) {
    throw new Error(`Missing level ${levelIndex}`);
  }

  const before = await mobileReloadState(page);
  await page.evaluate((route) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    route.forEach((point) => debugWindow.__shadowCircuitDebug?.movePlayerTo(point));
  }, level.validationRoute);
  await expectVisible(page, 'text=Exit Reached');
  await assertActionButtonsFit(page, '[data-testid="overlay"]');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Next Level' }).click();
  await expectVisible(page, '[data-testid="loading-panel"]');
  await assertPlayingPhase(page);

  const after = await mobileReloadState(page);
  if (after.levelId !== expectedNextLevelId || after.phase !== 'playing' || !after.playerVisible) {
    throw new Error(`Expected second mobile reload to enter ${expectedNextLevelId}, got ${JSON.stringify({ before, after })}`);
  }
  if (after.rendererMemory.geometries > before.rendererMemory.geometries + 80 || after.rendererMemory.textures > before.rendererMemory.textures + 20) {
    throw new Error(`Unexpected renderer resource growth after mobile reload: ${JSON.stringify({ before, after })}`);
  }
}

async function mobileReloadState(page: Page): Promise<{
  levelId: string | undefined;
  phase: string | undefined;
  playerVisible: boolean | undefined;
  rendererMemory: { geometries: number; textures: number };
}> {
  return page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelId: () => string;
        phase: () => string;
        playerVisible: () => boolean;
        rendererMemory: () => { geometries: number; textures: number };
      };
    };
    return {
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      playerVisible: debugWindow.__shadowCircuitDebug?.playerVisible(),
      rendererMemory: debugWindow.__shadowCircuitDebug?.rendererMemory() ?? { geometries: 0, textures: 0 },
    };
  });
}
