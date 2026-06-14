import { chromium, type ConsoleMessage } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/';
const screenshotDir = 'artifacts';
const headless = process.env.SMOKE_HEADLESS === 'true';

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
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${screenshotDir}/shadow-circuit-menu.png`, fullPage: true });

  await expectVisible('[data-testid="overlay"]');
  await expectVisible('text=Collect yellow keycards and blue terminals');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Level Select' }).click();
  await expectVisible('text=Signal Vault');
  const objectiveHintCount = await page.locator('.level-card-objectives').count();
  if (objectiveHintCount !== 8) {
    throw new Error(`Expected objective hints on all 8 level cards, found ${objectiveHintCount}`);
  }
  const levelCardCount = await page.locator('[data-level-index]').count();
  if (levelCardCount !== 8) {
    throw new Error(`Expected 8 level cards, found ${levelCardCount}`);
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
  if (debugLevelCount !== 8) {
    throw new Error(`Expected debug level count 8, found ${debugLevelCount}`);
  }
  await page.locator('[data-level-index="4"]').click();
  await page.waitForTimeout(500);
  const selectedLevelTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (selectedLevelTrackId !== 'ghost-steps') {
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
  await page.selectOption('[data-setting="quality"]', 'cinematic');
  await page.selectOption('[data-setting="soundtrack"]', 'metro-escape');
  await page.selectOption('[data-setting="detection-leniency"]', 'standard');
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Start Run' }).click();
  await page.waitForTimeout(800);
  await assertPlayingPhase('after start run');
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
  if (levelState.levelId !== 'signal-vault' || !levelState.goalVisible || !levelState.playerVisible || levelState.objectives?.totalRequired !== 2) {
    throw new Error(`Expected visible Signal Vault goal, got ${JSON.stringify(levelState)}`);
  }

  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { selectLevel: (levelIndex: number) => void } };
    debugWindow.__shadowCircuitDebug?.selectLevel(3);
  });
  await page.waitForTimeout(500);
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

  await page.waitForTimeout(1400);
  const debugText = await page.locator('[data-testid="debug-panel"]').innerText();
  if (!debugText.includes('FPS') || !debugText.includes('Target FPS') || !debugText.includes('Memory') || !debugText.includes('Quality')) {
    throw new Error(`Debug panel missing expected metrics: ${debugText}`);
  }
  const performanceSample = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        performance: () => null | { fps: number; usedMemoryMb: number | null; memoryCapMb: number; reservedMemoryMb: number };
      };
    };
    return debugWindow.__shadowCircuitDebug?.performance();
  });
  if (!performanceSample || performanceSample.fps < 55) {
    throw new Error(`Expected near-60 FPS sample, got ${JSON.stringify(performanceSample)}`);
  }
  if (performanceSample.reservedMemoryMb < 40) {
    throw new Error(`Expected cinematic memory reserve, got ${JSON.stringify(performanceSample)}`);
  }
  if (performanceSample.usedMemoryMb !== null && performanceSample.usedMemoryMb > performanceSample.memoryCapMb) {
    throw new Error(`Memory cap exceeded in browser smoke: ${JSON.stringify(performanceSample)}`);
  }

  if (!logs.some((line) => line.includes('[game] Shadow Circuit initialized'))) {
    throw new Error(`Expected initialization console log. Logs: ${logs.join('\n')}`);
  }

  if (!logs.some((line) => line.includes('[audio] soundtrack playing Metro Escape'))) {
    throw new Error(`Expected selected soundtrack console log. Logs: ${logs.join('\n')}`);
  }
  const activeTrackId = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { activeTrackId: () => string | null } };
    return debugWindow.__shadowCircuitDebug?.activeTrackId();
  });
  if (activeTrackId !== 'metro-escape') {
    throw new Error(`Expected active Metro Escape track, got ${activeTrackId}`);
  }

  const visibilityStates = await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        levelCount: () => number;
        levelId: () => string;
        selectLevel: (levelIndex: number) => void;
        goalVisible: () => boolean;
        playerVisible: () => boolean;
        objectiveVisible: (objectiveId: string) => boolean;
      };
    };
    const debug = debugWindow.__shadowCircuitDebug;
    if (!debug) return [];

    const states: {
      index: number;
      levelId: string;
      playerVisible: boolean;
      goalVisible: boolean;
      lensConsoleVisible: boolean;
    }[] = [];
    for (let index = 0; index < debug.levelCount(); index += 1) {
      debug.selectLevel(index);
      states.push({
        index,
        levelId: debug.levelId(),
        playerVisible: debug.playerVisible(),
        goalVisible: debug.goalVisible(),
        lensConsoleVisible: debug.objectiveVisible('lab-terminal-a'),
      });
    }
    return states;
  });
  const hiddenLevelStates = visibilityStates.filter((state) => !state.playerVisible || !state.goalVisible);
  if (hiddenLevelStates.length > 0) {
    throw new Error(`Expected every level start and goal to be camera-visible, got ${JSON.stringify(hiddenLevelStates)}`);
  }
  const mirrorLabState = visibilityStates.find((state) => state.levelId === 'mirror-lab');
  if (!mirrorLabState?.lensConsoleVisible) {
    throw new Error(`Expected Mirror Lab Lens Console to be camera-visible, got ${JSON.stringify(visibilityStates)}`);
  }

  await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectLevel: (levelIndex: number) => void;
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.selectLevel(0);
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
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -1.0, z: -1.2 });
  });
  await expectVisible('text=Collected Gate Keycard');
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 2.4, z: -3.4 });
  });
  await expectVisible('text=exit unlocked');
  await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { movePlayerTo: (point: { x: number; z: number }) => void } };
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 5, z: -3.2 });
  });
  await expectVisible('text=Exit Reached');
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

  await completeFinalLevel();
  await expectVisible('text=Game Complete');
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
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
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
  await page.locator('[data-testid="overlay"]').getByRole('button', { name: 'Retry Level' }).click();
  await page.locator('[data-testid="overlay"]').waitFor({ state: 'hidden', timeout: 8000 });
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

  console.info(`[browser-smoke] ok url=${baseUrl}`);
  console.info(`[browser-smoke] screenshots=${screenshotDir}/shadow-circuit-menu.png, ${screenshotDir}/shadow-circuit-playing.png`);
  console.info(`[browser-smoke] performance=${JSON.stringify(performanceSample)}`);
  console.info(`[browser-smoke] console-log-count=${logs.length}`);
} finally {
  await browser.close();
}

async function expectVisible(selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout: 8000 });
}

async function completeFinalLevel(): Promise<void> {
  await page.evaluate(() => {
    const debugWindow = window as Window & {
      __shadowCircuitDebug?: {
        selectLevel: (levelIndex: number) => void;
        movePlayerTo: (point: { x: number; z: number }) => void;
      };
    };
    debugWindow.__shadowCircuitDebug?.selectLevel(7);
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -7.4, z: 6.6 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: -0.5, z: -6.6 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 5.5, z: 6.6 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 9.6, z: -5.8 });
    debugWindow.__shadowCircuitDebug?.movePlayerTo({ x: 10, z: 7 });
  });
}

async function assertPlayingPhase(context: string): Promise<void> {
  const phase = await page.evaluate(() => {
    const debugWindow = window as Window & { __shadowCircuitDebug?: { phase: () => string } };
    return debugWindow.__shadowCircuitDebug?.phase();
  });
  if (phase !== 'playing') {
    throw new Error(`Expected playing phase ${context}, got ${phase}`);
  }
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
