import { soundtrackOptions } from './audio';
import { levelThumbnailSvg } from './assets';
import { heroOptions, type HeroId } from './heroes';
import { isLoadingPhase, isPlayingPhase } from './phase';
import type { GamePhase, GameSettings, LevelDefinition, LoadingProgress, ObjectiveProgress, RunSummary, SuspicionState, Vec2 } from './types';

type UiCallbacks = {
  onStart: () => void;
  onBeginBriefing: () => void;
  onSelectHero: (heroId: HeroId) => void;
  onConfirmHero: () => void;
  onResume: () => void;
  onSettings: () => void;
  onMenu: () => void;
  onTitle: () => void;
  onLevelSelect: () => void;
  onLevelSelectBack: () => void;
  onSelectLevel: (levelIndex: number) => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onStartOver: () => void;
  onToggleMute: () => void;
  onTouchMove: (movement: Vec2) => void;
  onTouchEnd: () => void;
  onSettingsChange: (settings: GameSettings) => void;
};

export class GameUi {
  readonly root: HTMLElement;
  readonly hud: HTMLElement;
  readonly debug: HTMLElement;
  readonly overlay: HTMLElement;
  readonly touchControls: HTMLElement;
  private readonly touchPad: HTMLElement;
  private activeTouchPointerId: number | null = null;
  private touchMovementActive = false;

  constructor(
    mount: HTMLElement,
    private settings: GameSettings,
    private readonly callbacks: UiCallbacks,
  ) {
    mount.innerHTML = `
      <main class="shell">
        <div class="viewport" data-testid="game-viewport"></div>
        <section class="hud" data-testid="hud"></section>
        <section class="debug" data-testid="debug-panel"></section>
        <section class="touch-controls" data-testid="touch-controls" hidden aria-label="Movement joystick">
          <div class="touch-pad" data-testid="touch-pad">
            <span class="touch-pad-line touch-pad-line-horizontal" aria-hidden="true"></span>
            <span class="touch-pad-line touch-pad-line-vertical" aria-hidden="true"></span>
            <span class="touch-stick" data-testid="touch-stick" aria-hidden="true"></span>
          </div>
        </section>
        <section class="overlay" data-testid="overlay"></section>
      </main>
    `;
    this.root = mount.querySelector('.viewport') ?? mount;
    this.hud = required(mount, '.hud');
    this.debug = required(mount, '.debug');
    this.overlay = required(mount, '.overlay');
    this.touchControls = required(mount, '.touch-controls');
    this.touchPad = required(mount, '.touch-pad');
    required(mount, '.touch-stick');
    this.bindTouchControls();
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  renderHud(
    level: LevelDefinition,
    levelNumber: number,
    phase: GamePhase,
    totalLevels: number,
    suspicion: SuspicionState,
    objectives: ObjectiveProgress,
    objectiveNotice: string,
    runElapsedMs: number | null,
    runAlertCount: number,
  ): void {
    if (!isPlayingPhase(phase)) {
      this.hud.innerHTML = '';
      return;
    }

    const statusText = statusLabel(phase, suspicion, objectives);
    const soundButtonLabel = this.settings.musicEnabled ? 'Mute' : 'Unmute';
    const soundButtonTitle = this.settings.musicEnabled ? 'Mute Sound' : 'Unmute Sound';
    this.hud.innerHTML = `
      <div class="hud-left">
        <strong>${level.name}</strong>
        <span>Level ${levelNumber + 1} / ${totalLevels}</span>
        ${runElapsedMs !== null ? `
          <span>Time <span class="run-time">${formatRunTime(runElapsedMs)}</span> / Par ${formatRunTime(level.parSeconds * 1000)}</span>
          <span>Alerts <span class="run-alerts">${runAlertCount}</span></span>
        ` : ''}
        ${objectives.totalRequired > 0 ? `
          <span>Objectives ${objectives.collectedRequired} / ${objectives.totalRequired}</span>
          <div class="objective-strip" aria-label="Objectives">
            ${objectives.items.map((objective) => `
              <span class="objective-chip ${objective.collected ? 'is-collected' : ''} objective-${objective.type}">
                <span class="objective-icon" aria-hidden="true"></span>
                <span class="objective-label">${objective.label}</span>
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="hud-right">
        <button type="button" data-action="toggle-mute" title="${soundButtonTitle}" aria-pressed="${!this.settings.musicEnabled}">${soundButtonLabel}</button>
        <button type="button" data-action="level-select" title="Level Select">Levels</button>
        <button type="button" data-action="settings" title="Settings">Settings</button>
        <button type="button" data-action="menu" title="Menu">Menu</button>
      </div>
      <div class="status-pill status-${suspicion.status}">
        <span>${statusText}</span>
        <span class="suspicion-meter"><span style="width: ${Math.round(suspicion.value * 100)}%"></span></span>
      </div>
      ${objectiveNotice ? `<div class="objective-notice" role="status">${objectiveNotice}</div>` : ''}
    `;
    this.bindHud();
  }

  updateRunHud(runElapsedMs: number, runAlertCount: number): void {
    const time = this.hud.querySelector('.run-time');
    const alerts = this.hud.querySelector('.run-alerts');
    if (time) time.textContent = formatRunTime(runElapsedMs);
    if (alerts) alerts.textContent = String(runAlertCount);
  }

  setTouchControlsVisible(visible: boolean): void {
    this.touchControls.hidden = !visible;
    this.touchControls.classList.toggle('is-visible', visible);
    if (!visible) {
      this.resetTouchControl();
    }
  }

  renderOverlay(
    phase: GamePhase,
    level: LevelDefinition,
    levels: readonly LevelDefinition[],
    levelIndex: number,
    runSummary: RunSummary | null,
    loadingProgress: LoadingProgress,
    selectedHeroId: HeroId,
  ): void {
    this.overlay.classList.toggle('is-loading', isLoadingPhase(phase));
    this.overlay.classList.toggle('is-title', phase === 'menu' || phase === 'character-select');
    this.overlay.classList.toggle('is-character-select', phase === 'character-select');
    this.overlay.hidden = isPlayingPhase(phase);
    if (isPlayingPhase(phase)) return;

    const isFinalLevel = levelIndex === levels.length - 1;

    if (isLoadingPhase(phase)) {
      const percent = Math.round(loadingProgress.value * 100);
      this.overlay.innerHTML = `
        <div class="panel loading-panel" data-testid="loading-panel">
          <h1>Loading</h1>
          <div class="loading-bar" data-testid="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <span style="width: ${percent}%"></span>
          </div>
          <p>${loadingProgress.label}</p>
        </div>
      `;
    } else if (phase === 'menu') {
      this.overlay.innerHTML = `
        <div class="panel menu-panel">
          <h1 class="title-wordmark" aria-label="Shadow Circuit">
            <span>Shadow</span>
            <span>Circuit</span>
          </h1>
          <p>Move unseen through the facility, read patrol lights, and break the circuit before the sentries close in.</p>
          <div class="panel-actions">
            <button type="button" data-action="start">Start Run</button>
            <button type="button" data-action="level-select">Level Select</button>
            <button type="button" data-action="settings">Settings</button>
          </div>
        </div>
      `;
    } else if (phase === 'character-select') {
      const selectedHero = heroOptions.find((hero) => hero.id === selectedHeroId) ?? heroOptions[0];
      this.overlay.innerHTML = `
        <div class="panel character-select-panel" data-testid="character-select-panel">
          <h1>Select Operative</h1>
          <p>${selectedHero.name} is ready for the run.</p>
          <div class="hero-grid" role="list" aria-label="Hero roster">
            ${heroOptions.map((hero) => `
              <button
                type="button"
                class="hero-card ${hero.id === selectedHeroId ? 'is-active' : ''}"
                data-hero-id="${hero.id}"
                aria-pressed="${hero.id === selectedHeroId}"
                style="--hero-accent: ${hero.accentColor}"
              >
                <span class="hero-card-name">${hero.name}</span>
                <span class="hero-card-role">${hero.role}</span>
                <span class="hero-card-copy">${hero.description}</span>
              </button>
            `).join('')}
          </div>
          <div class="panel-actions">
            <button type="button" data-action="confirm-hero">Start Level</button>
            <button type="button" data-action="menu">Title</button>
          </div>
        </div>
      `;
    } else if (phase === 'briefing') {
      this.overlay.innerHTML = `
        <div class="panel briefing-panel" data-testid="briefing-panel">
          <h1>Mission Briefing</h1>
          <p>${level.briefing}</p>
          <div class="briefing-grid">
            <div class="briefing-item">
              <span class="briefing-icon objective-keycard" aria-hidden="true"><span class="objective-icon"></span></span>
              <strong>Keycards</strong>
              <span>Yellow access cards are required. Collect every required card before heading for the exit.</span>
            </div>
            <div class="briefing-item">
              <span class="briefing-icon objective-terminal" aria-hidden="true"><span class="objective-icon"></span></span>
              <strong>Terminals</strong>
              <span>Blue consoles complete the access chain. Each collected terminal removes its HUD chip.</span>
            </div>
            <div class="briefing-item">
              <span class="briefing-icon sentry-icon" aria-hidden="true"></span>
              <strong>Sentries</strong>
              <span>Red sentries patrol fixed routes. Amber cones show their vision; cover blocks sight, but touching a sentry ends the run.</span>
            </div>
            <div class="briefing-item">
              <span class="briefing-icon exit-icon" aria-hidden="true"></span>
              <strong>Exit Pad</strong>
              <span>The exit turns green after the required collectibles are secured.</span>
            </div>
          </div>
          <div class="panel-actions">
            <button type="button" data-action="begin-briefing">Start Level</button>
            <button type="button" data-action="menu">Title</button>
          </div>
        </div>
      `;
    } else if (phase === 'level-select') {
      this.overlay.innerHTML = `
        <div class="panel level-select-panel">
          <h1>Level Select</h1>
          <div class="level-grid">
            ${levels.map((candidate, index) => `
              <button type="button" class="level-card ${index === levelIndex ? 'is-active' : ''}" data-level-index="${index}">
                <span class="level-thumb">${levelThumbnailSvg(candidate, index + 1)}</span>
                <span class="level-card-title">${candidate.name}</span>
                <span class="level-card-copy">${candidate.briefing}</span>
                ${candidate.objectives?.length ? `
                  <span class="level-card-objectives">${candidate.objectives.length} objectives unlock the exit</span>
                ` : ''}
              </button>
            `).join('')}
          </div>
          <div class="panel-actions">
            <button type="button" data-action="level-select-back">Back</button>
          </div>
        </div>
      `;
    } else if (phase === 'settings') {
      this.overlay.innerHTML = `
        <div class="panel settings-panel">
          <h1>Settings</h1>
          <label>Render quality
            <select data-setting="quality">
              <option value="memory" ${this.settings.quality === 'memory' ? 'selected' : ''}>Memory first</option>
              <option value="balanced" ${this.settings.quality === 'balanced' ? 'selected' : ''}>Balanced</option>
              <option value="cinematic" ${this.settings.quality === 'cinematic' ? 'selected' : ''}>Cinematic</option>
            </select>
          </label>
          <label class="check-row">
            <input type="checkbox" data-setting="music" ${this.settings.musicEnabled ? 'checked' : ''}/>
            Music
          </label>
          <label>Soundtrack
            <select data-setting="soundtrack">
              ${soundtrackOptions.map((track) => `
                <option value="${track.id}" ${this.settings.soundtrackId === track.id ? 'selected' : ''}>${track.name}</option>
              `).join('')}
            </select>
          </label>
          <p class="settings-note">${selectedTrack(this.settings.soundtrackId).source.attribution}</p>
          <label>Detection leniency
            <select data-setting="detection-leniency">
              <option value="forgiving" ${this.settings.detectionLeniency === 'forgiving' ? 'selected' : ''}>Forgiving</option>
              <option value="standard" ${this.settings.detectionLeniency === 'standard' ? 'selected' : ''}>Standard</option>
              <option value="sharp" ${this.settings.detectionLeniency === 'sharp' ? 'selected' : ''}>Sharp</option>
            </select>
          </label>
          <label class="check-row">
            <input type="checkbox" data-setting="debug" ${this.settings.debugEnabled ? 'checked' : ''}/>
            Debug tools
          </label>
          <label>Volume
            <input type="range" min="0" max="1" step="0.01" value="${this.settings.masterVolume}" data-setting="volume"/>
          </label>
          <div class="panel-actions">
            <button type="button" data-action="resume">Back</button>
          </div>
        </div>
      `;
    } else if (phase === 'caught') {
      this.overlay.innerHTML = `
        <div class="panel">
          <h1>Detected</h1>
          <p>A guard traced your movement. Reset the room and use the shadows.</p>
          <div class="panel-actions">
            <button type="button" data-action="restart">Retry Level</button>
            <button type="button" data-action="settings">Settings</button>
          </div>
        </div>
      `;
    } else if (phase === 'complete') {
      this.overlay.innerHTML = `
        <div class="panel">
          <h1>${isFinalLevel ? 'Game Complete' : 'Exit Reached'}</h1>
          ${runSummary ? `
            <div class="run-summary" aria-label="Run summary">
              <div class="run-grade grade-${runSummary.grade.toLowerCase()}">
                <span>Grade</span>
                <strong>${runSummary.grade}</strong>
              </div>
              <dl class="run-stat-grid">
                <div>
                  <dt>Time</dt>
                  <dd>${formatRunTime(runSummary.elapsedMs)}</dd>
                </div>
                <div>
                  <dt>Par</dt>
                  <dd>${formatRunTime(runSummary.parSeconds * 1000)}</dd>
                </div>
                <div>
                  <dt>Alerts</dt>
                  <dd>${runSummary.alerts}</dd>
                </div>
                <div>
                  <dt>Score</dt>
                  <dd>${runSummary.score}</dd>
                </div>
              </dl>
            </div>
            <p class="record-note">${bestTimeLabel(runSummary)}</p>
          ` : `<p>${level.briefing}</p>`}
          <div class="panel-actions">
            ${isFinalLevel ? `
              <button type="button" data-action="title">Title</button>
              <button type="button" data-action="start-over">Start Over</button>
            ` : `
              <button type="button" data-action="next">Next Level</button>
              <button type="button" data-action="menu">Menu</button>
            `}
          </div>
        </div>
      `;
    }

    this.bindOverlay();
  }

  private bindHud(): void {
    this.hud.querySelector('[data-action="toggle-mute"]')?.addEventListener('click', this.callbacks.onToggleMute);
    this.hud.querySelector('[data-action="settings"]')?.addEventListener('click', this.callbacks.onSettings);
    this.hud.querySelector('[data-action="level-select"]')?.addEventListener('click', this.callbacks.onLevelSelect);
    this.hud.querySelector('[data-action="menu"]')?.addEventListener('click', this.callbacks.onMenu);
  }

  private bindTouchControls(): void {
    this.touchPad.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (this.touchControls.hidden) return;

      event.preventDefault();
      this.activeTouchPointerId = event.pointerId;
      this.touchPad.setPointerCapture(event.pointerId);
      this.updateTouchMovement(event);
    });

    this.touchPad.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.activeTouchPointerId) return;

      event.preventDefault();
      this.updateTouchMovement(event);
    });

    this.touchPad.addEventListener('pointerup', (event) => this.releaseTouchMovement(event));
    this.touchPad.addEventListener('pointercancel', (event) => this.releaseTouchMovement(event));
    this.touchPad.addEventListener('lostpointercapture', (event) => this.releaseTouchMovement(event));
  }

  private updateTouchMovement(event: PointerEvent): void {
    const rect = this.touchPad.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.38);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const factor = distance > radius ? radius / distance : 1;
    const x = rawX * factor;
    const y = rawY * factor;

    this.touchMovementActive = true;
    this.touchPad.style.setProperty('--stick-x', `${x}px`);
    this.touchPad.style.setProperty('--stick-y', `${y}px`);
    this.callbacks.onTouchMove({ x: x / radius, z: y / radius });
  }

  private releaseTouchMovement(event: PointerEvent): void {
    if (event.pointerId !== this.activeTouchPointerId) return;

    if (this.touchPad.hasPointerCapture(event.pointerId)) {
      this.touchPad.releasePointerCapture(event.pointerId);
    }
    this.activeTouchPointerId = null;
    this.resetTouchControl();
  }

  private resetTouchControl(): void {
    this.touchPad.style.setProperty('--stick-x', '0px');
    this.touchPad.style.setProperty('--stick-y', '0px');
    this.activeTouchPointerId = null;
    if (!this.touchMovementActive) return;

    this.touchMovementActive = false;
    this.callbacks.onTouchEnd();
  }

  private bindOverlay(): void {
    this.overlay.querySelector('[data-action="start"]')?.addEventListener('click', this.callbacks.onStart);
    this.overlay.querySelector('[data-action="begin-briefing"]')?.addEventListener('click', this.callbacks.onBeginBriefing);
    this.overlay.querySelector('[data-action="confirm-hero"]')?.addEventListener('click', this.callbacks.onConfirmHero);
    this.overlay.querySelectorAll('[data-hero-id]').forEach((button) => {
      button.addEventListener('click', () => {
        this.callbacks.onSelectHero((button as HTMLElement).dataset.heroId as HeroId);
      });
    });
    this.overlay.querySelector('[data-action="resume"]')?.addEventListener('click', this.callbacks.onResume);
    this.overlay.querySelectorAll('[data-action="level-select"]').forEach((button) =>
      button.addEventListener('click', this.callbacks.onLevelSelect),
    );
    this.overlay.querySelector('[data-action="level-select-back"]')?.addEventListener('click', this.callbacks.onLevelSelectBack);
    this.overlay.querySelectorAll('[data-level-index]').forEach((button) => {
      button.addEventListener('click', () => {
        this.callbacks.onSelectLevel(Number((button as HTMLElement).dataset.levelIndex));
      });
    });
    this.overlay.querySelectorAll('[data-action="settings"]').forEach((button) =>
      button.addEventListener('click', this.callbacks.onSettings),
    );
    this.overlay.querySelector('[data-action="menu"]')?.addEventListener('click', this.callbacks.onMenu);
    this.overlay.querySelector('[data-action="title"]')?.addEventListener('click', this.callbacks.onTitle);
    this.overlay.querySelector('[data-action="restart"]')?.addEventListener('click', this.callbacks.onRestart);
    this.overlay.querySelector('[data-action="next"]')?.addEventListener('click', this.callbacks.onNextLevel);
    this.overlay.querySelector('[data-action="start-over"]')?.addEventListener('click', this.callbacks.onStartOver);
    this.overlay.querySelector('[data-setting="quality"]')?.addEventListener('change', (event) => {
      this.callbacks.onSettingsChange({ ...this.settings, quality: (event.target as HTMLSelectElement).value as GameSettings['quality'] });
    });
    this.overlay.querySelector('[data-setting="music"]')?.addEventListener('change', (event) => {
      this.callbacks.onSettingsChange({ ...this.settings, musicEnabled: (event.target as HTMLInputElement).checked });
    });
    this.overlay.querySelector('[data-setting="soundtrack"]')?.addEventListener('change', (event) => {
      this.callbacks.onSettingsChange({ ...this.settings, soundtrackId: (event.target as HTMLSelectElement).value as GameSettings['soundtrackId'] });
    });
    this.overlay.querySelector('[data-setting="detection-leniency"]')?.addEventListener('change', (event) => {
      this.callbacks.onSettingsChange({
        ...this.settings,
        detectionLeniency: (event.target as HTMLSelectElement).value as GameSettings['detectionLeniency'],
      });
    });
    this.overlay.querySelector('[data-setting="debug"]')?.addEventListener('change', (event) => {
      this.callbacks.onSettingsChange({ ...this.settings, debugEnabled: (event.target as HTMLInputElement).checked });
    });
    this.overlay.querySelector('[data-setting="volume"]')?.addEventListener('input', (event) => {
      this.callbacks.onSettingsChange({ ...this.settings, masterVolume: Number((event.target as HTMLInputElement).value) });
    });
  }
}

function statusLabel(phase: GamePhase, suspicion: SuspicionState, objectives: ObjectiveProgress): string {
  if (isLoadingPhase(phase)) return 'Loading';
  if (!isPlayingPhase(phase)) return phase;
  if (suspicion.status === 'detected') return 'Detected';
  if (suspicion.status === 'suspicious') return 'Suspicious';
  if (!objectives.exitUnlocked) return 'Exit locked';
  return 'Stay hidden';
}

function selectedTrack(soundtrackId: GameSettings['soundtrackId']): (typeof soundtrackOptions)[number] {
  return soundtrackOptions.find((track) => track.id === soundtrackId) ?? soundtrackOptions[0];
}

function formatRunTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function bestTimeLabel(summary: RunSummary): string {
  if (summary.isNewBest) return 'New best time recorded.';
  if (summary.bestTimeMs === null) return 'First clear recorded.';
  return `Best time: ${formatRunTime(summary.bestTimeMs)}.`;
}

function required(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing UI element ${selector}`);
  }
  return element;
}
