import { chromium, type ConsoleMessage } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import packageInfo from '../package.json';
import { levels } from '../src/game/levels';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/';
const screenshotDir = 'artifacts';
const tutorialScreenshotDir = 'docs/2026-06-18-first-run-cinematic-tutorial/screenshots';
const headless = process.env.SMOKE_HEADLESS === 'true';
const playingTimeoutMs = parseTimeout(process.env.SMOKE_PLAYING_TIMEOUT_MS, 45000);
const expectedVersionLabel = `v${packageInfo.version}`;
const expectedLevelCount = levels.length;
const expectedMasteryChipCount = expectedLevelCount * 4;
const maxFrameMs = headless ? 1800 : 600;

const browser = await chromium.launch({
  headless,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
const logs: string[] = [];

page.on('console', (message: ConsoleMessage) => {
  logs.push(`[${message.type()}] ${message.text()}`);
});

try {
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(tutorialScreenshotDir, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await assertAppIdentity();
  await expectVisible('[data-testid="overlay"]');
  await assertVersionBadge();
  await expectVisible('text=Break the circuit before sentries close in.');
  const initialNextRunCount = await page.locator('[data-testid="next-run"]').count();
  if (initialNextRunCount !== 0) {
    throw new Error(`Expected Next Run to stay hidden for empty profiles, found ${initialNextRunCount}`);
  }
  const titleObjectiveTextCount = await page.getByText('Collect yellow keycards and blue terminals').count();
  if (titleObjectiveTextCount !== 0) {
    throw new Error('Title screen should not show objective briefing text');
  }
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        titleHero: () => { visible: boolean; cinematic: boolean; activeState: string | null; clipNames: readonly string[]; x: number | null };
      };
    };
    const state = debugWindow.__shadowCircuitDebug?.titleHero();
    return Boolean(state?.visible && state.cinematic && state.activeState === 'idle' && state.clipNames.some((name) => /idle/i.test(name)));
  }, null, { timeout: 12000 });
  const initialLoadingCount = await page.locator('[data-testid="loading-panel"]').count();
  if (initialLoadingCount !== 0) {
    throw new Error(`Expected title screen without preload, found ${initialLoadingCount} loading panels`);
  }
  const initialPhase = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase();
  });
  if (initialPhase !== 'menu') {
    throw new Error(`Expected initial menu phase without preloading, got ${initialPhase}`);
  }
  const initialTitleTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (initialTitleTrackId !== 'title-on-patrol') {
    throw new Error(`Expected title menu music, got ${initialTitleTrackId}`);
  }
  await assertTitleGoalsPanel();
  await assertTitleQualitySettingsNoLevelScene();
  await page.evaluate(() => {
    const startButton = document.querySelector('[data-action="start"]');
    if (startButton instanceof HTMLButtonElement) {
      startButton.click();
      startButton.click();
    }
  });
  await expectLoadingCover('loading hero roster');
  await expectVisible('[data-testid="character-select-panel"]');
  const characterSelectPanelCount = await page.locator('[data-testid="character-select-panel"]').count();
  if (characterSelectPanelCount !== 1) {
    throw new Error(`Expected one character-select panel after rapid Start Run clicks, found ${characterSelectPanelCount}`);
  }
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-character-select.png`, fullPage: true });
  const characterSelectState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        selectedHero: () => string;
        heroRoster: () => readonly string[];
        activeTrackId: () => string | null;
        titleHero: () => { visible: boolean; cinematic: boolean; activeState: string | null; clipNames: readonly string[]; x: number | null };
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      selectedHero: debugWindow.__shadowCircuitDebug?.selectedHero(),
      heroRoster: debugWindow.__shadowCircuitDebug?.heroRoster(),
      activeTrackId: debugWindow.__shadowCircuitDebug?.activeTrackId(),
      titleHero: debugWindow.__shadowCircuitDebug?.titleHero(),
    };
  });
  if (
    characterSelectState.phase !== 'character-select' ||
    characterSelectState.selectedHero !== 'shadow-operative' ||
    characterSelectState.heroRoster?.length !== 4 ||
    characterSelectState.activeTrackId !== 'title-on-patrol' ||
    !characterSelectState.titleHero?.visible ||
    characterSelectState.titleHero.x === null ||
    characterSelectState.titleHero.x < 2.2
  ) {
    throw new Error(`Expected loaded character select with shifted hero preview, got ${JSON.stringify(characterSelectState)}`);
  }
  const heroCardLabels = await page.locator('[data-hero-id]').allTextContents();
  for (const heroName of ['Shadow Operative', 'Echo Vanguard', 'Signal Warden', 'Circuit Nomad']) {
    if (!heroCardLabels.some((label) => label.includes(heroName))) {
      throw new Error(`Missing hero card ${heroName}: ${JSON.stringify(heroCardLabels)}`);
    }
  }
  await page.locator('[data-hero-id="echo-vanguard"]').click();
  const selectedHero = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { selectedHero: () => string } };
    return debugWindow.__shadowCircuitDebug?.selectedHero();
  });
  if (selectedHero !== 'echo-vanguard') {
    throw new Error(`Expected Echo Vanguard selection, got ${selectedHero}`);
  }
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  await expectLoadingCover('starting first-run cinematic tutorial');
  await assertFirstRunTutorial();
  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Menu' }).click();
  await expectVisible('[data-testid="title-panel"]');
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-menu.png`, fullPage: true });
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Levels' }).click();
  await expectVisible('text=Signal Vault');
  const objectiveHintCount = await page.locator('.level-card-objectives').count();
  if (objectiveHintCount !== expectedLevelCount) {
    throw new Error(`Expected objective hints on all ${expectedLevelCount} level cards, found ${objectiveHintCount}`);
  }
  const masteryCardCount = await page.locator('.level-mastery').count();
  const masteryChipCount = await page.locator('.level-mastery-chip').count();
  if (masteryCardCount !== expectedLevelCount || masteryChipCount !== expectedMasteryChipCount) {
    throw new Error(`Expected mastery chips on all level cards, got cards=${masteryCardCount} chips=${masteryChipCount}`);
  }
  const firstMasteryText = await page.locator('[data-testid="level-mastery-dock-blackout"]').innerText();
  if (!firstMasteryText.includes('Clear the route') || !firstMasteryText.includes('Best - / -:--')) {
    throw new Error(`Expected empty Dock Blackout mastery target, got ${firstMasteryText}`);
  }
  const levelCardCount = await page.locator('[data-level-index]').count();
  if (levelCardCount !== expectedLevelCount) {
    throw new Error(`Expected ${expectedLevelCount} level cards, found ${levelCardCount}`);
  }
  const levelSelectLayout = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="overlay"]');
    const cards = [...document.querySelectorAll('[data-level-index]')];
    if (!(overlay instanceof HTMLElement)) return null;

    const viewportHeight = window.innerHeight;
    const allCardsReachable = cards.every((card) => {
      const rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= viewportHeight;
    });

    return {
      allCardsReachable,
      canScroll: overlay.scrollHeight > overlay.clientHeight,
      overlayClientHeight: overlay.clientHeight,
      overlayScrollHeight: overlay.scrollHeight,
    };
  });
  if (!levelSelectLayout || (!levelSelectLayout.allCardsReachable && !levelSelectLayout.canScroll)) {
    throw new Error(`Level select is neither fully visible nor scrollable: ${JSON.stringify(levelSelectLayout)}`);
  }
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-level-select.png`, fullPage: true });
  const debugLevelCount = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { levelCount: () => number } };
    return debugWindow.__shadowCircuitDebug?.levelCount();
  });
  if (debugLevelCount !== expectedLevelCount) {
    throw new Error(`Expected debug level count ${expectedLevelCount}, found ${debugLevelCount}`);
  }
  await page.locator('[data-level-index="4"]').click();
  await expectLoadingCover('selecting Signal Vault');
  await assertPlayingPhase('after selecting Signal Vault from level select');
  const selectedLevelTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (selectedLevelTrackId !== 'dark-sci-fi-pulse') {
    throw new Error(`Expected music to start after selecting a non-first level, got ${selectedLevelTrackId}`);
  }
  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Mute' }).click();
  await page.waitForTimeout(250);
  const mutedMusicEnabled = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { musicEnabled: () => boolean } };
    return debugWindow.__shadowCircuitDebug?.musicEnabled();
  });
  if (mutedMusicEnabled !== false) {
    throw new Error(`Expected HUD mute button to disable audio, got ${mutedMusicEnabled}`);
  }
  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Unmute' }).click();
  await page.waitForTimeout(500);
  const unmutedMusicEnabled = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { musicEnabled: () => boolean } };
    return debugWindow.__shadowCircuitDebug?.musicEnabled();
  });
  if (unmutedMusicEnabled !== true) {
    throw new Error(`Expected HUD mute button to re-enable audio, got ${unmutedMusicEnabled}`);
  }
  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Menu' }).click();
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await expectVisible('text=Render quality');
  const debugSettingCount = await page.locator('[data-setting="debug"]').count();
  const debugToolsTextCount = await page.getByText('Debug tools', { exact: true }).count();
  if (debugSettingCount !== 0 || debugToolsTextCount !== 0) {
    throw new Error(`Expected debug tools checkbox to be hidden, found setting=${debugSettingCount} text=${debugToolsTextCount}`);
  }
  await page.locator('[data-testid="debug-panel"]').waitFor({ state: 'hidden', timeout: 8000 });
  await page.selectOption('[data-setting="quality"]', 'cinematic');
  const selectedRenderQuality = await page.evaluate(() => {
    const select = document.querySelector('[data-setting="quality"]') as HTMLSelectElement | null;
    return select?.value;
  });
  if (selectedRenderQuality !== 'cinematic') {
    throw new Error(`Expected render quality selection to persist as cinematic, got ${selectedRenderQuality}`);
  }
  const soundtrackLabels = await page.locator('[data-setting="soundtrack"] option').allTextContents();
  for (const track of ['Dark Sci-Fi: Sector', 'Dark Sci-Fi: Airy', 'Dark Sci-Fi: Pulse', 'Dark Sci-Fi: Urgent', 'Dark Sci-Fi: Transmission', 'Insistent', 'Lost Signal']) {
    if (!soundtrackLabels.includes(track)) {
      throw new Error(`Missing soundtrack option ${track}: ${JSON.stringify(soundtrackLabels)}`);
    }
  }
  for (const trackId of [
    'ghost-steps',
    'cyberpunk-moonlight',
    'dark-sci-fi-sector',
    'dark-sci-fi-airy',
    'dark-sci-fi-pulse',
    'dark-sci-fi-urgent',
    'dark-sci-fi-transmission',
    'insistent',
    'future-loading-loop',
    'lost-signal',
    'background-space',
    'ambient-horror',
  ] as const) {
    await page.selectOption('[data-setting="soundtrack"]', trackId);
    await page.waitForFunction((expectedTrackId) => {
      const debugWindow = window as Window & {
        __shadowCircuitDebug?: {
          musicPlayback: () => {
            activeTrackId: string | null;
            paused: boolean;
            readyState: number;
            errorCode: number | null;
            volume: number;
          };
        };
      };
      const state = debugWindow.__shadowCircuitDebug?.musicPlayback();
      return Boolean(
        state?.activeTrackId === expectedTrackId &&
          state.paused === false &&
          state.readyState >= 2 &&
          state.errorCode === null &&
          state.volume > 0.25,
      );
    }, trackId, { timeout: 8000 });
  }
  await page.selectOption('[data-setting="soundtrack"]', 'cyberpunk-moonlight');
  await expectVisible('text=Cyberpunk Moonlight Sonata v2');
  await page.selectOption('[data-setting="detection-leniency"]', 'standard');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Run' }).click();
  await expectLoadingCover('loading hero roster before starting run');
  await expectVisible('[data-testid="character-select-panel"]');
  await page.locator('[data-hero-id="signal-warden"]').click();
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  const briefingVisible = await page.locator('[data-testid="briefing-panel"]').waitFor({ state: 'visible', timeout: 1200 })
    .then(() => true)
    .catch(() => false);
  if (briefingVisible) {
    await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Level' }).click();
  }
  await expectLoadingCover('starting run');
  await assertPlayingPhase('after start run');
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | { frameMs: number };
        shaderWarmupPasses: () => number;
      };
    };
    const debug = debugWindow.__shadowCircuitDebug;
    const sample = debug?.performance();
    return Boolean(sample && (debug?.shaderWarmupPasses() ?? 0) >= 3);
  }, undefined, { timeout: 12000 });
  const postLoadWarmupState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | { frameMs: number; drawCalls: number; triangles: number };
        shaderWarmupPasses: () => number;
      };
    };
    return {
      shaderWarmupPasses: debugWindow.__shadowCircuitDebug?.shaderWarmupPasses() ?? 0,
      performance: debugWindow.__shadowCircuitDebug?.performance(),
    };
  });
  if (
    postLoadWarmupState.shaderWarmupPasses < 3 ||
    !postLoadWarmupState.performance ||
    postLoadWarmupState.performance.frameMs > maxFrameMs ||
    postLoadWarmupState.performance.drawCalls <= 0 ||
    postLoadWarmupState.performance.triangles <= 0
  ) {
    throw new Error(`Expected async shader warmup before first playable frame, got ${JSON.stringify(postLoadWarmupState)}`);
  }
  const beforeKeyboardMove = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { playerPosition: () => { x: number; z: number } } };
    return debugWindow.__shadowCircuitDebug?.playerPosition();
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(360);
  await page.keyboard.up('ArrowRight');
  const afterKeyboardMove = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { playerPosition: () => { x: number; z: number } } };
    return debugWindow.__shadowCircuitDebug?.playerPosition();
  });
  if (!beforeKeyboardMove || !afterKeyboardMove || afterKeyboardMove.x <= beforeKeyboardMove.x + 0.15) {
    throw new Error(`Expected keyboard movement to increase x: before=${JSON.stringify(beforeKeyboardMove)} after=${JSON.stringify(afterKeyboardMove)}`);
  }

  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Settings' }).click();
  await expectVisible('text=Render quality');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
  await assertPlayingPhase('after returning from in-game settings');
  const restoredDockTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (restoredDockTrackId !== 'ghost-steps') {
    throw new Error(`Expected restored Dock Blackout level track after settings, got ${restoredDockTrackId}`);
  }

  await page.locator('[data-testid="hud"]').getByRole('button', { name: 'Levels' }).click();
  await expectVisible('text=Level Select');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
  await assertPlayingPhase('after returning from in-game level select');

  const levelState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelId: () => string;
        goalVisible: () => boolean;
        playerVisible: () => boolean;
        objectives: () => { totalRequired: number; collectedRequired: number; exitUnlocked: boolean };
      };
    };
    return {
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      goalVisible: debugWindow.__shadowCircuitDebug?.goalVisible(),
      playerVisible: debugWindow.__shadowCircuitDebug?.playerVisible(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
    };
  });
  if (levelState.levelId !== 'dock-blackout' || !levelState.goalVisible || !levelState.playerVisible || levelState.objectives?.totalRequired !== 2) {
    throw new Error(`Expected visible Dock Blackout goal after title start, got ${JSON.stringify(levelState)}`);
  }

  await selectDebugLevel(3);
  const neonAtriumState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelId: () => string;
        playerVisible: () => boolean;
        objectives: () => { totalRequired: number };
      };
    };
    return {
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      playerVisible: debugWindow.__shadowCircuitDebug?.playerVisible(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
    };
  });
  if (neonAtriumState.levelId !== 'neon-atrium' || !neonAtriumState.playerVisible || neonAtriumState.objectives?.totalRequired !== 2) {
    throw new Error(`Expected visible Neon Atrium start with objectives, got ${JSON.stringify(neonAtriumState)}`);
  }

  const playingScreenshot = await page.screenshot({ path: `${screenshotDir}/shadow-circuit-playing.png`, fullPage: true });

  const visiblePixels = countVisiblePixels(playingScreenshot);
  if (visiblePixels < 2500) {
    throw new Error(`Screenshot pixel check failed: visiblePixels=${visiblePixels}`);
  }

  await assertDesktopIntelPulse();

  await page.keyboard.press('F1');
  await page.locator('[data-testid="debug-panel"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1400);
  const debugText = await page.locator('[data-testid="debug-panel"]').innerText();
  if (!debugText.includes('FPS') || !debugText.includes('Target FPS') || !debugText.includes('Memory') || !debugText.includes('Quality')) {
    throw new Error(`Debug panel missing expected metrics: ${debugText}`);
  }
  if (!debugText.includes('Quality: cinematic')) {
    throw new Error(`Expected debug panel to retain cinematic quality, got: ${debugText}`);
  }
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | {
          fps: number;
          frameMs: number;
          drawCalls: number;
          triangles: number;
        };
      };
    };
    const sample = debugWindow.__shadowCircuitDebug?.performance();
    return Boolean(sample && sample.fps > 0);
  }, undefined, { timeout: 12000 });
  const performanceSample = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | {
          fps: number;
          frameMs: number;
          usedMemoryMb: number | null;
          memoryCapMb: number;
          reservedMemoryMb: number;
          memoryPressure: 'unknown' | 'ok' | 'over-cap';
          drawCalls: number;
          triangles: number;
        };
      };
    };
    return debugWindow.__shadowCircuitDebug?.performance();
  });
  if (
    !performanceSample ||
    performanceSample.fps <= 0 ||
    performanceSample.frameMs > maxFrameMs ||
    performanceSample.drawCalls <= 0 ||
    performanceSample.triangles <= 0
  ) {
    throw new Error(`Expected live frame pacing sample under ${maxFrameMs}ms, got ${JSON.stringify(performanceSample)}`);
  }
  const frameCountBefore = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { renderFrameCount: () => number } };
    return debugWindow.__shadowCircuitDebug?.renderFrameCount() ?? 0;
  });
  await page.waitForTimeout(350);
  const nextPerformanceSample = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | {
          fps: number;
          frameMs: number;
          drawCalls: number;
          triangles: number;
        };
      };
    };
    return debugWindow.__shadowCircuitDebug?.performance();
  });
  const frameCountAfter = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { renderFrameCount: () => number } };
    return debugWindow.__shadowCircuitDebug?.renderFrameCount() ?? 0;
  });
  if (
    !nextPerformanceSample ||
    nextPerformanceSample.fps <= 0 ||
    nextPerformanceSample.frameMs > maxFrameMs ||
    nextPerformanceSample.drawCalls <= 0 ||
    nextPerformanceSample.triangles <= 0 ||
    frameCountAfter <= frameCountBefore
  ) {
    throw new Error(
      `Expected renderer-owned animation loop to keep advancing render stats: before=${JSON.stringify({
        ...performanceSample,
        frameCount: frameCountBefore,
      })} after=${JSON.stringify({ ...nextPerformanceSample, frameCount: frameCountAfter })}`,
    );
  }
  if (performanceSample.reservedMemoryMb < 60) {
    throw new Error(`Expected cinematic memory reserve, got ${JSON.stringify(performanceSample)}`);
  }
  if (performanceSample.usedMemoryMb !== null) {
    const expectedPressure = performanceSample.usedMemoryMb > performanceSample.memoryCapMb ? 'over-cap' : 'ok';
    if (performanceSample.memoryPressure !== expectedPressure) {
      throw new Error(`Expected memory pressure ${expectedPressure}, got ${JSON.stringify(performanceSample)}`);
    }
  }

  if (!logs.some((line) => line.includes('[game] Shadow Circuit initialized'))) {
    throw new Error(`Expected initialization console log. Logs: ${logs.join('\n')}`);
  }

  if (!logs.some((line) => line.includes('[audio] soundtrack playing Cyberpunk Moonlight'))) {
    throw new Error(`Expected selected soundtrack console log. Logs: ${logs.join('\n')}`);
  }
  for (const assetType of ['keycard', 'terminal']) {
    if (!logs.some((line) => line.includes(`[assets] loaded cinematic objective ${assetType}`))) {
      throw new Error(`Expected cinematic objective asset ${assetType} to preload. Logs: ${logs.join('\n')}`);
    }
  }
  for (const assetType of ['hero', 'sentry']) {
    if (!logs.some((line) => line.includes(`[assets] loaded cinematic character ${assetType}`))) {
      throw new Error(`Expected cinematic character asset ${assetType} to preload. Logs: ${logs.join('\n')}`);
    }
  }
  const activeTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (activeTrackId !== 'cyberpunk-moonlight') {
    throw new Error(`Expected active Neon Atrium level track, got ${activeTrackId}`);
  }

  const visibilityStates: {
    index: number;
    levelId: string;
    playerVisible: boolean;
    goalVisible: boolean;
    lensConsoleVisible: boolean;
  }[] = [];
  for (let index = 0; index < debugLevelCount; index += 1) {
    await selectDebugLevel(index);
    visibilityStates.push(await page.evaluate((levelIndex) => {
      const debugWindow = window as Window & {
        __shadowCircuitDebug?: {
          levelId: () => string;
          goalVisible: () => boolean;
          playerVisible: () => boolean;
          objectiveVisible: (objectiveId: string) => boolean;
        };
      };
      const debug = debugWindow.__shadowCircuitDebug;
      return {
        index: levelIndex,
        levelId: debug?.levelId() ?? '',
        playerVisible: debug?.playerVisible() ?? false,
        goalVisible: debug?.goalVisible() ?? false,
        lensConsoleVisible: debug?.objectiveVisible('lab-terminal-a') ?? false,
      };
    }, index));
  }
  const hiddenLevelStates = visibilityStates.filter((state) => !state.playerVisible || !state.goalVisible);
  if (hiddenLevelStates.length > 0) {
    throw new Error(`Expected every level start and goal to be camera-visible, got ${JSON.stringify(hiddenLevelStates)}`);
  }
  const mirrorLabState = visibilityStates.find((state) => state.levelId === 'mirror-lab');
  if (!mirrorLabState?.lensConsoleVisible) {
    throw new Error(`Expected Mirror Lab Lens Console to be camera-visible, got ${JSON.stringify(visibilityStates)}`);
  }

  await selectDebugLevel(0);
  await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 1.6, z: -2.5 });
  });
  await page.waitForTimeout(320);
  const suspicious = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { suspicion: () => { status: string; value: number } } };
    return debugWindow.__shadowCircuitDebug?.suspicion();
  });
  if (!suspicious || suspicious.status !== 'suspicious' || suspicious.value <= 0) {
    throw new Error(`Expected suspicious buildup, got ${JSON.stringify(suspicious)}`);
  }
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -5, z: 3.4 });
  });
  await page.waitForTimeout(900);
  const recovered = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { suspicion: () => { status: string; value: number } } };
    return debugWindow.__shadowCircuitDebug?.suspicion();
  });
  if (!recovered || recovered.status !== 'hidden') {
    throw new Error(`Expected suspicion recovery, got ${JSON.stringify(recovered)}`);
  }

  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 5, z: -3.2 });
  });
  await page.waitForTimeout(300);
  const lockedExitState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        objectives: () => { collectedRequired: number; totalRequired: number; exitUnlocked: boolean };
        goalLit: () => boolean;
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
      goalLit: debugWindow.__shadowCircuitDebug?.goalLit(),
    };
  });
  if (lockedExitState.phase !== 'playing' || lockedExitState.objectives?.exitUnlocked || lockedExitState.goalLit) {
    throw new Error(`Expected locked exit before objectives, got ${JSON.stringify(lockedExitState)}`);
  }
  const firstPickupLatencyMs = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    const startedAt = performance.now();
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -1.0, z: -1.2 });
    return performance.now() - startedAt;
  });
  if (firstPickupLatencyMs > 80) {
    throw new Error(`Expected warmed first pickup below 80ms, got ${firstPickupLatencyMs.toFixed(1)}ms`);
  }
  await expectVisible('text=Collected Gate Keycard');
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        pickupDebug: () => { id: string | null; framesObserved: number };
      };
    };
    const pickup = debugWindow.__shadowCircuitDebug?.pickupDebug();
    return pickup?.id === 'dock-keycard' && pickup.framesObserved > 0;
  });
  const firstPickupDebug = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        pickupDebug: () => {
          id: string | null;
          totalMs: number;
          audioMs: number;
          uiMs: number;
          frameSpikeMs: number;
          framesObserved: number;
          audio: { status: string; bufferReady: boolean; gain: number };
        };
      };
    };
    return debugWindow.__shadowCircuitDebug?.pickupDebug();
  });
  if (
    firstPickupDebug?.id !== 'dock-keycard' ||
    firstPickupDebug.totalMs > 80 ||
    firstPickupDebug.audio.status !== 'played' ||
    !firstPickupDebug.audio.bufferReady ||
    firstPickupDebug.audio.gain < 0.3
  ) {
    throw new Error(`Unexpected pickup debug sample: ${JSON.stringify(firstPickupDebug)}`);
  }
  const pickupDebugText = await page.locator('[data-testid="debug-panel"]').innerText();
  if (!pickupDebugText.includes('Pickup cost') || !pickupDebugText.includes('Pickup audio')) {
    throw new Error(`Debug panel missing pickup diagnostics: ${pickupDebugText}`);
  }
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 2.4, z: -3.4 });
  });
  await expectVisible('text=exit unlocked');
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 5, z: -3.2 });
  });
  await expectVisible('text=Level 1 Completed');
  await expectVisible('[data-testid="retry-target"]');
  await expectVisible('[data-testid="run-delta"]');
  const runDeltaText = await page.locator('[data-testid="run-delta"]').innerText();
  if (!runDeltaText.includes('Par ')) {
    throw new Error(`Expected first completion Run Delta to compare against par, got ${runDeltaText}`);
  }
  const retryTargetText = await page.locator('[data-testid="retry-target"]').innerText();
  if (!retryTargetText.includes('Retry for S') && !retryTargetText.includes('Second clear ready')) {
    throw new Error(`Expected context-aware Retry Target after first clear, got ${retryTargetText}`);
  }
  const pickupChimeCount = logs.filter((line) => line.includes('[audio] pickup chime')).length;
  if (pickupChimeCount < 2) {
    throw new Error(`Expected pickup chime for both objectives, got ${pickupChimeCount}. Logs: ${logs.join('\n')}`);
  }
  const objectiveCompleteState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        objectives: () => { collectedRequired: number; totalRequired: number; exitUnlocked: boolean };
        goalLit: () => boolean;
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
      goalLit: debugWindow.__shadowCircuitDebug?.goalLit(),
    };
  });
  if (objectiveCompleteState.phase !== 'complete' || !objectiveCompleteState.objectives?.exitUnlocked || !objectiveCompleteState.goalLit) {
    throw new Error(`Expected objective-gated completion, got ${JSON.stringify(objectiveCompleteState)}`);
  }
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Next Level' }).click();
  await expectLoadingCover('next level');
  await assertPlayingPhase('after next level loading');
  const nextLevelState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelId: () => string;
        objectives: () => { totalRequired: number };
      };
    };
    return {
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
    };
  });
  if (nextLevelState.levelId !== 'archive-lanes' || nextLevelState.objectives?.totalRequired !== 2) {
    throw new Error(`Expected Next Level to load Archive Lanes, got ${JSON.stringify(nextLevelState)}`);
  }

  await seedSecondSweepAchievementUnlock();
  await completeFinalLevel();
  await expectVisible(`text=Level ${levels.length} Completed`);
  await expectVisible('[data-testid="achievement-toast"]');
  const achievementToastText = await page.locator('[data-testid="achievement-toast"]').innerText();
  const normalizedAchievementToastText = achievementToastText.toLowerCase();
  if (!normalizedAchievementToastText.includes('achievement unlocked') || !achievementToastText.includes('Second Sweep')) {
    throw new Error(`Expected Second Sweep achievement toast, got ${achievementToastText}`);
  }
  const achievementState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        achievements: () => readonly { id: string; progress: number; target: number; unlocked: boolean }[];
      };
    };
    return debugWindow.__shadowCircuitDebug?.achievements();
  });
  const secondSweep = achievementState?.find((achievement) => achievement.id === 'clear-all-levels-twice');
  if (!secondSweep?.unlocked || secondSweep.progress !== secondSweep.target) {
    throw new Error(`Expected Second Sweep achievement to be complete, got ${JSON.stringify(achievementState)}`);
  }
  const finalButtonLabels = await page.locator('[data-testid="overlay"]').getByRole('button').allTextContents();
  if (
    finalButtonLabels.includes('Next Level') ||
    !finalButtonLabels.includes('Title') ||
    !finalButtonLabels.includes('Start Over')
  ) {
    throw new Error(`Expected final completion actions Title and Start Over only, got ${JSON.stringify(finalButtonLabels)}`);
  }
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Title' }).click();
  const titleState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        levelId: () => string;
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
    };
  });
  if (titleState.phase !== 'menu' || titleState.levelId !== 'dock-blackout') {
    throw new Error(`Expected Title to return to Dock Blackout menu, got ${JSON.stringify(titleState)}`);
  }

  await completeFinalLevel();
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Over' }).click();
  await expectLoadingCover('start over');
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 10000 });
  const startOverState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        levelId: () => string;
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      levelId: debugWindow.__shadowCircuitDebug?.levelId(),
    };
  });
  if (startOverState.phase !== 'playing' || startOverState.levelId !== 'dock-blackout') {
    throw new Error(`Expected Start Over to begin Dock Blackout, got ${JSON.stringify(startOverState)}`);
  }

  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { forceCaught: () => void } };
    debugWindow.__shadowCircuitDebug?.forceCaught();
  });
  await expectVisible('text=Retry Level');
  await expectVisible('[data-testid="caught-target"]');
  const caughtTargetText = await page.locator('[data-testid="caught-target"]').innerText();
  if (!caughtTargetText.toLowerCase().includes('still open')) {
    throw new Error(`Expected detected panel to show a retry target, got ${caughtTargetText}`);
  }
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Retry Level' }).click();
  await expectLoadingCover('retry level');
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 10000 });
  const phase = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase();
  });
  if (phase !== 'playing') {
    throw new Error(`Retry Level did not return to playing phase: ${phase}`);
  }

  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { forceEnemyCollision: () => void } };
    debugWindow.__shadowCircuitDebug?.forceEnemyCollision();
  });
  await expectVisible('text=Retry Level');
  await expectVisible('[data-testid="caught-target"]');
  await assertNextRunForPartialProfile();
  await assertEncorePickForMasteredProfile();

  console.info(`[browser-smoke] ok url=${baseUrl}`);
  console.info(
    `[browser-smoke] screenshots=${screenshotDir}/shadow-circuit-menu.png, ${screenshotDir}/shadow-circuit-playing.png, ${tutorialScreenshotDir}/01-tutorial-hero-closeup-desktop.png`,
  );
  console.info(`[browser-smoke] performance=${JSON.stringify(performanceSample)}`);
  console.info(`[browser-smoke] console-log-count=${logs.length}`);
} finally {
  await browser.close();
}

async function expectVisible(selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout: 8000 });
}

type TutorialShotId = 'hero' | 'sentry' | 'keycard' | 'terminal' | 'goal' | 'good-luck';

async function assertFirstRunTutorial(): Promise<void> {
  await expectVisible('[data-testid="tutorial-panel"]');
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        tutorialState: () => { active: boolean; step: string; targetVisible: boolean; selectedHero: string; desktopEligible: boolean; seen: boolean };
      };
    };
    const debug = debugWindow.__shadowCircuitDebug;
    const state = debug?.tutorialState();
    return Boolean(
      debug?.phase() === 'tutorial' &&
        state?.active &&
        state.step === 'hero' &&
        state.targetVisible &&
        state.selectedHero === 'echo-vanguard' &&
        state.desktopEligible &&
        state.seen,
    );
  }, undefined, { timeout: 12000 });

  await captureTutorialShot('hero', `${tutorialScreenshotDir}/01-tutorial-hero-closeup-desktop.png`, 'Echo Vanguard');
  await captureTutorialShot('sentry', `${tutorialScreenshotDir}/02-tutorial-sentry-closeup-desktop.png`, 'Sentries');
  await captureTutorialShot('keycard', `${tutorialScreenshotDir}/03-tutorial-keycard-terminal-closeup-desktop.png`, 'Access Cards');
  await captureTutorialShot('terminal', `${tutorialScreenshotDir}/03b-tutorial-terminal-closeup-desktop.png`, 'Terminals');
  await captureTutorialShot('goal', `${tutorialScreenshotDir}/04-tutorial-goal-closeup-desktop.png`, 'Exit Pad');
  await captureTutorialShot('good-luck', `${tutorialScreenshotDir}/05-tutorial-good-luck-desktop.png`, 'Good luck, cadet.');

  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { skipTutorial: () => void } };
    debugWindow.__shadowCircuitDebug?.skipTutorial();
  });
  await assertPlayingPhase('after first-run tutorial');
  await page.locator('[data-testid="tutorial-panel"]').waitFor({ state: 'hidden', timeout: 8000 });
  const playableState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        objectives: () => { collectedRequired: number; totalRequired: number; exitUnlocked: boolean };
        playerVisible: () => boolean;
      };
    };
    return {
      phase: debugWindow.__shadowCircuitDebug?.phase(),
      objectives: debugWindow.__shadowCircuitDebug?.objectives(),
      playerVisible: debugWindow.__shadowCircuitDebug?.playerVisible(),
    };
  });
  if (
    playableState.phase !== 'playing' ||
    playableState.objectives?.collectedRequired !== 0 ||
    playableState.objectives.totalRequired !== 2 ||
    playableState.objectives.exitUnlocked ||
    !playableState.playerVisible
  ) {
    throw new Error(`Expected clean playable state after tutorial, got ${JSON.stringify(playableState)}`);
  }
}

async function captureTutorialShot(shotId: TutorialShotId, path: string, expectedTitle: string): Promise<void> {
  const changed = await page.evaluate((id) => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { setTutorialShot: (shotId: string) => boolean } };
    return debugWindow.__shadowCircuitDebug?.setTutorialShot(id) ?? false;
  }, shotId);
  if (!changed) {
    throw new Error(`Could not switch tutorial to ${shotId}`);
  }

  await page.waitForFunction((id) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        tutorialState: () => {
          active: boolean;
          step: string;
          targetVisible: boolean;
          targetScreen: { x: number; y: number } | null;
          phase: string;
        };
      };
    };
    const state = debugWindow.__shadowCircuitDebug?.tutorialState();
    return Boolean(state?.phase === 'tutorial' && state.active && state.step === id && state.targetVisible && state.targetScreen);
  }, shotId, { timeout: 8000 });

  await expectVisible(`[data-testid="tutorial-panel"][data-step="${shotId}"]`);
  const panelText = await page.locator('[data-testid="tutorial-panel"]').innerText();
  if (!panelText.includes(expectedTitle)) {
    throw new Error(`Expected tutorial shot ${shotId} title ${expectedTitle}, got ${panelText}`);
  }
  await assertTutorialCaptionLayout();
  await page.screenshot({ path, fullPage: true });
}

async function assertTutorialCaptionLayout(): Promise<void> {
  const layout = await page.locator('[data-testid="tutorial-panel"]').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      text: panel.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
  if (
    layout.left < 0 ||
    layout.right > layout.viewport.width ||
    layout.bottom > layout.viewport.height ||
    layout.top < layout.viewport.height * 0.48 ||
    layout.width < 420 ||
    !layout.text.includes('Field Briefing')
  ) {
    throw new Error(`Unexpected tutorial caption layout: ${JSON.stringify(layout)}`);
  }
}

async function assertVersionBadge(): Promise<void> {
  await expectVisible('[data-testid="app-version"]');
  const versionText = await page.locator('[data-testid="app-version"]').innerText();
  if (versionText.trim() !== expectedVersionLabel) {
    throw new Error(`Expected version badge ${expectedVersionLabel}, got ${versionText}`);
  }
}

async function assertTitleGoalsPanel(): Promise<void> {
  const inlineAchievementSummaryCount = await page.locator('[data-testid="achievement-summary"]').count();
  if (inlineAchievementSummaryCount !== 0) {
    throw new Error(`Expected title screen to keep goals in a separate panel, found ${inlineAchievementSummaryCount} inline summaries`);
  }

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Goals' }).click();
  await expectVisible('[data-testid="goals-panel"]');
  await expectVisible('[data-testid="mastery-summary"]');
  const masterySummaryText = await page.locator('[data-testid="mastery-summary"]').innerText();
  const normalizedMasterySummaryText = masterySummaryText.toLowerCase();
  if (!normalizedMasterySummaryText.includes('mastery circuit') || !normalizedMasterySummaryText.includes(`0 / ${expectedLevelCount} mastered`)) {
    throw new Error(`Expected initial Mastery Circuit summary, got ${masterySummaryText}`);
  }
  const achievementCardCount = await page.locator('[data-achievement-id]').count();
  if (achievementCardCount !== 4) {
    throw new Error(`Expected 4 goals rows, found ${achievementCardCount}`);
  }

  const achievementText = await page.locator('[data-testid="achievement-summary"]').innerText();
  for (const label of ['Circuit Complete', 'Clean Entry', 'Perfect Shadow', 'Second Sweep']) {
    if (!achievementText.includes(label)) {
      throw new Error(`Missing achievement label ${label}: ${achievementText}`);
    }
  }

  const achievementState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        achievements: () => readonly { id: string; progress: number; target: number; unlocked: boolean }[];
      };
    };
    return debugWindow.__shadowCircuitDebug?.achievements();
  });
  if (!achievementState || achievementState.length !== 4 || achievementState.some((achievement) => achievement.progress !== 0)) {
    throw new Error(`Expected empty initial achievement progress, got ${JSON.stringify(achievementState)}`);
  }

  const goalsPhase = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase();
  });
  if (goalsPhase !== 'goals') {
    throw new Error(`Expected Goals button to open goals phase, got ${goalsPhase}`);
  }

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await expectVisible('text=Break the circuit before sentries close in.');
}

async function assertTitleQualitySettingsNoLevelScene(): Promise<void> {
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Settings' }).click();
  await expectVisible('text=Render quality');
  await page.selectOption('[data-setting="quality"]', 'memory');
  await page.waitForFunction(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        runtimeQuality: () => string;
        sceneObjectCounts: () => {
          objectives: number;
          enemies: number;
          blockers: number;
          goalInScene: boolean;
          titlePreviewVisible: boolean;
        };
      };
    };
    const counts = debugWindow.__shadowCircuitDebug?.sceneObjectCounts();
    return (
      debugWindow.__shadowCircuitDebug?.runtimeQuality() === 'memory' &&
      counts?.objectives === 0 &&
      counts.enemies === 0 &&
      counts.blockers === 0 &&
      !counts.goalInScene &&
      counts.titlePreviewVisible
    );
  }, undefined, { timeout: 8000 });
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-title-quality-settings.png`, fullPage: true });
  await page.selectOption('[data-setting="quality"]', 'cinematic');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await expectVisible('text=Break the circuit before sentries close in.');
}

async function expectLoadingCover(context: string): Promise<void> {
  await expectVisible('[data-testid="loading-panel"]');
  const loadingState = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="overlay"]');
    const style = overlay ? window.getComputedStyle(overlay) : null;
    return {
      hasLoadingClass: overlay?.classList.contains('is-loading') ?? false,
      backgroundColor: style?.backgroundColor ?? null,
      hidden: overlay?.hasAttribute('hidden') ?? null,
    };
  });
  if (!loadingState.hasLoadingClass || loadingState.hidden || loadingState.backgroundColor !== 'rgb(0, 0, 0)') {
    throw new Error(`Expected black loading cover while ${context}, got ${JSON.stringify(loadingState)}`);
  }
}

async function assertAppIdentity(): Promise<void> {
  try {
    await page.waitForFunction((expectedVersion) => {
      const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
      const version = document.querySelector('[data-testid="app-version"]')?.textContent?.trim();
      return document.title === 'Shadow Circuit' && version === expectedVersion && typeof debugWindow.__shadowCircuitDebug?.phase === 'function';
    }, expectedVersionLabel, { timeout: 12000 });
  } catch (error) {
    const diagnostics = await collectSmokeDiagnostics();
    throw new Error(
      `Smoke URL ${baseUrl} is not serving Shadow Circuit ${expectedVersionLabel}: ${JSON.stringify(diagnostics)}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function seedSecondSweepAchievementUnlock(): Promise<void> {
  const records = Object.fromEntries(
    levels.map((level, index) => [
      level.id,
      {
        clears: index === levels.length - 1 ? 1 : 2,
        bestGrade: 'S',
      },
    ]),
  );
  await page.evaluate((seedRecords) => {
    window.localStorage.setItem('shadow-circuit-achievements-v1', JSON.stringify(seedRecords));
  }, records);
}

async function assertNextRunForPartialProfile(): Promise<void> {
  await page.addInitScript((allLevels) => {
    const achievementRecords = {
      [allLevels[0].id]: { clears: 2, bestGrade: 'S' },
      [allLevels[1].id]: { clears: 1, bestGrade: 'A' },
    };
    const runRecords = {
      [allLevels[0].id]: { bestTimeMs: allLevels[0].parSeconds * 1000 - 4000 },
    };

    window.localStorage.clear();
    window.localStorage.setItem('shadow-circuit-achievements-v1', JSON.stringify(achievementRecords));
    window.localStorage.setItem('shadow-circuit-run-records-v1', JSON.stringify(runRecords));
  }, levels);
  await page.goto(`${baseUrl}?next-run-smoke=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expectVisible('[data-testid="title-panel"]');
  await expectVisible('[data-testid="next-run"]');

  const nextRunText = await page.locator('[data-testid="next-run"]').innerText();
  if (!nextRunText.toLowerCase().includes('next run') || !nextRunText.includes('Archive Lanes') || !nextRunText.includes('Replay for S')) {
    throw new Error(`Expected partial-progress Next Run for Archive Lanes, got ${nextRunText}`);
  }

  await page.locator('[data-testid="next-run"]').getByRole('button', { name: 'Run' }).click();
  await expectVisible('[data-testid="loading-panel"]');
  await assertPlayingPhase('after selecting Next Run');
  const nextRunState = await page.evaluate(() => {
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
  if (nextRunState.levelId !== 'archive-lanes' || nextRunState.phase !== 'playing') {
    throw new Error(`Expected Next Run to load Archive Lanes, got ${JSON.stringify(nextRunState)}`);
  }
}

async function assertEncorePickForMasteredProfile(): Promise<void> {
  await page.addInitScript((allLevels) => {
    const achievementRecords = Object.fromEntries(
      allLevels.map((level: { id: string }) => [level.id, { clears: 2, bestGrade: 'S' }]),
    );
    const runRecords = Object.fromEntries(
      allLevels.map((level: { id: string; parSeconds: number }, index: number) => [
        level.id,
        { bestTimeMs: level.parSeconds * 1000 - (index === 1 ? 500 : 3500 + index * 50) },
      ]),
    );

    window.localStorage.clear();
    window.localStorage.setItem('shadow-circuit-achievements-v1', JSON.stringify(achievementRecords));
    window.localStorage.setItem('shadow-circuit-run-records-v1', JSON.stringify(runRecords));
  }, levels);
  await page.goto(`${baseUrl}?encore-smoke=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expectVisible('[data-testid="title-panel"]');

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Goals' }).click();
  await expectVisible('[data-testid="encore-pick"]');
  const goalsEncoreText = await page.locator('[data-testid="encore-pick"]').innerText();
  if (!goalsEncoreText.toLowerCase().includes('encore pick') || !goalsEncoreText.includes('Archive Lanes')) {
    throw new Error(`Expected mastered Goals Encore Pick for Archive Lanes, got ${goalsEncoreText}`);
  }
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await expectVisible('[data-testid="title-panel"]');

  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Levels' }).click();
  await expectVisible('[data-testid="encore-pick"]');
  const levelSelectEncoreText = await page.locator('[data-testid="encore-pick"]').innerText();
  const highlightedEncoreCard = await page.locator('.level-card.is-encore[data-level-index="1"]').count();
  if (!levelSelectEncoreText.includes('Beat best') || highlightedEncoreCard !== 1) {
    throw new Error(
      `Expected Level Select Encore Pick and highlighted Archive Lanes card, got text=${levelSelectEncoreText} highlighted=${highlightedEncoreCard}`,
    );
  }

  await page.locator('[data-testid="encore-pick"]').getByRole('button', { name: 'Beat best' }).click();
  await expectLoadingCover('encore pick');
  await assertPlayingPhase('after selecting Encore Pick');
  const encoreState = await page.evaluate(() => {
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
  if (encoreState.levelId !== 'archive-lanes' || encoreState.phase !== 'playing') {
    throw new Error(`Expected Encore Pick to load Archive Lanes, got ${JSON.stringify(encoreState)}`);
  }
}

async function selectDebugLevel(levelIndex: number): Promise<void> {
  await page.evaluate(async (targetLevelIndex) => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectLevel: (levelIndex: number) => Promise<void>;
      };
    };
    await debugWindow.__shadowCircuitDebug?.selectLevel(targetLevelIndex);
  }, levelIndex);
  await assertPlayingPhase(`after debug selecting level ${levelIndex}`);
}

async function assertDesktopIntelPulse(): Promise<void> {
  const beforePulsePerformance = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | { drawCalls: number; triangles: number };
      };
    };
    return debugWindow.__shadowCircuitDebug?.performance();
  });
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
        intelPulseVisualStats: () => {
          objects: number;
          meshes: number;
          instancedMeshes: number;
          lines: number;
          instances: number;
        };
      };
    };
    const state = debugWindow.__shadowCircuitDebug?.intelPulse();
    const stats = debugWindow.__shadowCircuitDebug?.intelPulseVisualStats();
    return Boolean(
      state?.active &&
        state.charges === 2 &&
        state.mobileSimplified === false &&
        state.objectiveTargets > 0 &&
        state.exitTargets === 1 &&
        state.patrolRoutes > 0 &&
        state.waypointTargets >= state.patrolRoutes * 2 &&
        stats &&
        stats.instancedMeshes > 0 &&
        stats.instances >= (state.objectiveTargets + state.exitTargets) * 3 + state.waypointTargets,
    );
  }, undefined, { timeout: 8000 });
  await page.waitForTimeout(250);
  const pulseVisualState = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        intelPulse: () => {
          objectiveTargets: number;
          exitTargets: number;
          patrolRoutes: number;
          waypointTargets: number;
        };
        intelPulseVisualStats: () => {
          objects: number;
          meshes: number;
          instancedMeshes: number;
          lines: number;
          instances: number;
        };
        performance: () => null | { drawCalls: number; triangles: number };
      };
    };
    return {
      intel: debugWindow.__shadowCircuitDebug?.intelPulse(),
      stats: debugWindow.__shadowCircuitDebug?.intelPulseVisualStats(),
      performance: debugWindow.__shadowCircuitDebug?.performance(),
    };
  });
  const expectedMinimumInstances =
    ((pulseVisualState.intel?.objectiveTargets ?? 0) + (pulseVisualState.intel?.exitTargets ?? 0)) * 3 +
    (pulseVisualState.intel?.waypointTargets ?? 0);
  const drawCallGrowth = beforePulsePerformance && pulseVisualState.performance
    ? pulseVisualState.performance.drawCalls - beforePulsePerformance.drawCalls
    : 0;
  if (
    !pulseVisualState.stats ||
    pulseVisualState.stats.meshes !== 0 ||
    pulseVisualState.stats.instancedMeshes < 4 ||
    pulseVisualState.stats.lines !== pulseVisualState.intel?.patrolRoutes ||
    pulseVisualState.stats.instances < expectedMinimumInstances ||
    drawCallGrowth > 24
  ) {
    throw new Error(
      `Expected instanced Intel Pulse visuals with bounded draw-call growth, got ${JSON.stringify({
        beforePulsePerformance,
        pulseVisualState,
        expectedMinimumInstances,
        drawCallGrowth,
      })}`,
    );
  }

  const dockLayout = await page.locator('[data-testid="intel-pulse-dock"]').evaluate((dock) => {
    const rect = dock.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      text: dock.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
  if (
    dockLayout.left < 0 ||
    dockLayout.top < 0 ||
    dockLayout.right > dockLayout.viewport.width ||
    dockLayout.bottom > dockLayout.viewport.height ||
    !dockLayout.text.includes('Intel Pulse')
  ) {
    throw new Error(`Expected desktop intel pulse dock to fit and show label, got ${JSON.stringify(dockLayout)}`);
  }

  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-intel-pulse.png`, fullPage: true });
}

async function completeFinalLevel(): Promise<void> {
  await selectDebugLevel(11);
  await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -9.6, z: -8.0 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -3.0, z: 8.0 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 7.2, z: -8.0 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 10.2, z: -3.2 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 11, z: 8 });
  });
}

async function assertPlayingPhase(context: string): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
      return debugWindow.__shadowCircuitDebug?.phase() === 'playing';
    }, undefined, { timeout: playingTimeoutMs });
  } catch (error) {
    const diagnostics = await collectSmokeDiagnostics();
    throw new Error(
      `Timed out waiting for playing phase ${context} after ${playingTimeoutMs}ms: ${JSON.stringify(diagnostics)}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const phase = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase();
  });
  if (phase !== 'playing') {
    throw new Error(`Expected playing phase ${context}, got ${phase}`);
  }
}

async function collectSmokeDiagnostics(): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        phase: () => string;
        levelId: () => string;
        loadingProgress: () => { value: number; label: string };
      };
    };
    const overlay = document.querySelector('[data-testid="overlay"]');
    const version = document.querySelector('[data-testid="app-version"]')?.textContent?.trim() ?? null;

    return {
      href: window.location.href,
      title: document.title,
      version,
      hasDebugHook: Boolean(debugWindow.__shadowCircuitDebug),
      phase: debugWindow.__shadowCircuitDebug?.phase?.() ?? null,
      levelId: debugWindow.__shadowCircuitDebug?.levelId?.() ?? null,
      loadingProgress: debugWindow.__shadowCircuitDebug?.loadingProgress?.() ?? null,
      overlayText: overlay?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? null,
    };
  });
}

function countVisiblePixels(buffer: Buffer): number {
  const png = PNG.sync.read(buffer);
  let count = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    const alpha = png.data[index + 3];
    if (alpha > 0 && red + green + blue > 45) {
      count += 1;
    }
  }
  return count;
}

function parseTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
