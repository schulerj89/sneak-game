import { soundtrackOptions } from './audio';
import { levelThumbnailSvg, logoSvg } from './assets';
import type { GamePhase, GameSettings, LevelDefinition, ObjectiveProgress, SuspicionState } from './types';

type UiCallbacks = {
  onStart: () => void;
  onResume: () => void;
  onSettings: () => void;
  onMenu: () => void;
  onLevelSelect: () => void;
  onLevelSelectBack: () => void;
  onSelectLevel: (levelIndex: number) => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onSettingsChange: (settings: GameSettings) => void;
};

export class GameUi {
  readonly root: HTMLElement;
  readonly hud: HTMLElement;
  readonly debug: HTMLElement;
  readonly overlay: HTMLElement;

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
        <section class="overlay" data-testid="overlay"></section>
      </main>
    `;
    this.root = mount.querySelector('.viewport') ?? mount;
    this.hud = required(mount, '.hud');
    this.debug = required(mount, '.debug');
    this.overlay = required(mount, '.overlay');
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
  ): void {
    const statusText = statusLabel(phase, suspicion, objectives);
    this.hud.innerHTML = `
      <div class="hud-left">
        <strong>${level.name}</strong>
        <span>Level ${levelNumber + 1} / ${totalLevels}</span>
        ${objectives.totalRequired > 0 ? `
          <span>Objectives ${objectives.collectedRequired} / ${objectives.totalRequired}</span>
          <div class="objective-strip" aria-label="Objectives">
            ${objectives.items.map((objective) => `
              <span class="objective-chip ${objective.collected ? 'is-collected' : ''} objective-${objective.type}">
                <span class="objective-icon">${objective.type === 'keycard' ? 'KEY' : 'TERM'}</span>
                <span class="objective-label">${objective.label}</span>
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="hud-right">
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

  renderOverlay(phase: GamePhase, level: LevelDefinition, levels: readonly LevelDefinition[], levelIndex: number): void {
    this.overlay.hidden = phase === 'playing';

    if (phase === 'menu') {
      this.overlay.innerHTML = `
        <div class="panel menu-panel">
          <div class="logo">${logoSvg()}</div>
          <p>${level.briefing}</p>
          ${level.objectives?.length ? `
            <div class="objective-brief">
              <strong>Objectives</strong>
              <span>Collect yellow keycards and blue terminals to unlock the green exit.</span>
            </div>
          ` : ''}
          <div class="panel-actions">
            <button type="button" data-action="start">Start Run</button>
            <button type="button" data-action="level-select">Level Select</button>
            <button type="button" data-action="settings">Settings</button>
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
          <h1>Exit Reached</h1>
          <p>${level.briefing}</p>
          <div class="panel-actions">
            <button type="button" data-action="next">Next Level</button>
            <button type="button" data-action="menu">Menu</button>
          </div>
        </div>
      `;
    }

    this.bindOverlay();
  }

  private bindHud(): void {
    this.hud.querySelector('[data-action="settings"]')?.addEventListener('click', this.callbacks.onSettings);
    this.hud.querySelector('[data-action="level-select"]')?.addEventListener('click', this.callbacks.onLevelSelect);
    this.hud.querySelector('[data-action="menu"]')?.addEventListener('click', this.callbacks.onMenu);
  }

  private bindOverlay(): void {
    this.overlay.querySelector('[data-action="start"]')?.addEventListener('click', this.callbacks.onStart);
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
    this.overlay.querySelector('[data-action="restart"]')?.addEventListener('click', this.callbacks.onRestart);
    this.overlay.querySelector('[data-action="next"]')?.addEventListener('click', this.callbacks.onNextLevel);
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
  if (phase !== 'playing') return phase;
  if (suspicion.status === 'detected') return 'Detected';
  if (suspicion.status === 'suspicious') return 'Suspicious';
  if (!objectives.exitUnlocked) return 'Exit locked';
  return 'Stay hidden';
}

function selectedTrack(soundtrackId: GameSettings['soundtrackId']): (typeof soundtrackOptions)[number] {
  return soundtrackOptions.find((track) => track.id === soundtrackId) ?? soundtrackOptions[0];
}

function required(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing UI element ${selector}`);
  }
  return element;
}
