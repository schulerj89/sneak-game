import * as THREE from 'three';
import { achievementsStorageKey, loadAchievementProgress, recordLevelAchievementClear, type AchievementProgress } from './achievements';
import { type ActiveTrackId, MusicDirector, soundtrackIdForLevel } from './audio';
import { CharacterAssetLibrary, type CharacterAnimator } from './characterAssets';
import { collidesWithEnemies, collidesWithObstacles, enemyRadius, playerRadius } from './collision';
import { DebugPanel } from './debug';
import { advanceSuspicion, emptySuspicion, getDetectionState, isSightBlocked } from './detection';
import { defaultHeroId, heroOptions, isHeroId, type HeroId } from './heroes';
import { createIntelPulsePlan } from './intelPulse';
import { IntelPulseVisuals } from './intelPulseVisuals';
import { InputController } from './input';
import { levels } from './levels';
import { runLoadingSequence, type LoadingTask } from './loading';
import { add, clampToRoom, distance, normalize, scale, subtract } from './math';
import {
  buildEncorePick,
  buildNextRunTarget,
  loadLevelMasteryProgress,
  retryTargetForCompletion,
  type EncorePick,
  type LevelMasteryProgress,
  type NextRunTarget,
  type RetryTarget,
} from './mastery';
import { collectNearbyObjectives, getObjectiveProgress } from './objectives';
import { createObjectiveGlow, ObjectiveAssetLibrary } from './objectiveAssets';
import { isLoadingPhase, isPlayingPhase } from './phase';
import { shouldUseMobileMemorySafeAssets } from './platform';
import {
  beginPickupFrameProbe,
  createPickupDebugSample,
  emptyPickupDebugSample,
  updatePickupFrameProbe,
  type PickupDebugSample,
  type PickupFrameProbe,
} from './pickupDiagnostics';
import { createRunSummary, loadBestTime, runRecordsStorageKey, saveBestTime } from './runStats';
import { loadSettings, memoryCapMb, qualityProfile, saveSettings } from './settings';
import { createContactShadowMaterial, createFloorShaderMaterial, createGoalBeaconMaterial, createVisionConeGeometry } from './shaders';
import type {
  DebugSample,
  DetectionState,
  EnemySpec,
  GamePhase,
  GameSettings,
  IntelPulseUiState,
  LevelDefinition,
  ObjectiveDefinition,
  ObjectiveProgress,
  RenderQuality,
  LightSpec,
  LoadingProgress,
  RunSummary,
  SuspicionState,
  TutorialUiState,
  Vec2,
} from './types';
import { GameUi } from './ui';
import {
  clearVersionedFeatureRecords,
  firstRunCinematicTutorialFeature,
  markVersionedFeatureSeen,
  shouldShowVersionedFeature,
  versionedFeaturesStorageKey,
} from './versionFeatures';

type EnemyRuntime = {
  spec: EnemySpec;
  mesh: THREE.Object3D;
  animator: CharacterAnimator | null;
  cone: THREE.Mesh;
  light: THREE.SpotLight;
  lens: THREE.Mesh;
  contactShadow: THREE.Mesh;
  position: Vec2;
  facing: Vec2;
  patrolIndex: number;
  pauseRemaining: number;
};

type ObjectiveRuntime = {
  spec: ObjectiveDefinition;
  mesh: THREE.Object3D;
  glow: THREE.Object3D;
};

type CollectObjectiveOptions = Readonly<{
  audioSettings?: GameSettings;
  recordDebug?: boolean;
  startFrameProbe?: boolean;
  log?: boolean;
  logAudio?: boolean;
}>;

type StartRunOptions = Readonly<{
  playFirstRunTutorial?: boolean;
}>;

type TutorialShotId = 'hero' | 'sentry' | 'keycard' | 'terminal' | 'goal' | 'good-luck';

type TutorialShot = Readonly<{
  id: TutorialShotId;
  title: string;
  body: string;
  target: THREE.Vector3;
  camera: THREE.Vector3;
  focus: THREE.Object3D | null;
  durationMs: number;
  final?: boolean;
}>;

type TutorialDebugState = TutorialUiState & Readonly<{
  phase: GamePhase;
  targetVisible: boolean;
  targetScreen: { x: number; y: number } | null;
  selectedHero: HeroId;
  desktopEligible: boolean;
  seen: boolean;
}>;

const enemyHoverBaseY = 0.72;
const enemyHoverAmplitude = 0.12;
const enemyHoverSpeed = 1.45;
const titleHeroBaseX = 1.45;
const titleHeroMenuBaseX = 1.72;
const characterSelectHeroBaseX = 2.35;
const compactCharacterSelectHeroBaseX = 1.35;
const titleHeroBaseY = 0.24;
const compactCharacterSelectHeroBaseY = 1.18;
const compactCharacterSelectHeroScale = 1.12;
const compactLandscapeLevelCameraScale = 0.9;
const achievementLevelIds = levels.map((level) => level.id);
const silentPickupWarmupVolume = 0.0001;
const intelPulseMaxCharges = 3;
const intelPulseDurationMs = 5200;
const intelPulseCooldownMs = 8500;
const legacyFirstRunTutorialStorageKey = 'shadow-circuit-first-run-tutorial-v1';
const progressionStorageKeys = [achievementsStorageKey, runRecordsStorageKey] as const;
const tutorialEaseDurationMs = 1100;
const inactiveTutorialUiState: TutorialUiState = {
  active: false,
  step: '',
  title: '',
  body: '',
  progress: 0,
  final: false,
};

declare global {
  interface Window {
    __shadowCircuitDebug?: {
      forceCaught: () => void;
      phase: () => GamePhase;
      selectLevel: (levelIndex: number) => Promise<void>;
      levelCount: () => number;
      loadingProgress: () => LoadingProgress;
      pickupDebug: () => PickupDebugSample;
      performance: () => DebugSample | null;
      renderFrameCount: () => number;
      shaderWarmupPasses: () => number;
      levelId: () => string;
      goalVisible: () => boolean;
      playerVisible: () => boolean;
      objectiveVisible: (objectiveId: string) => boolean;
      forceEnemyCollision: () => void;
      suspicion: () => SuspicionState;
      objectives: () => ObjectiveProgress;
      goalLit: () => boolean;
      movePlayerTo: (point: Vec2) => void;
      playerPosition: () => Vec2;
      heroAnimation: () => { activeState: string | null; clipNames: readonly string[]; yaw: number; debugCamera: boolean };
      setHeroDebugView: (enabled: boolean) => void;
      titleHero: () => {
        visible: boolean;
        inCamera: boolean;
        cinematic: boolean;
        activeState: string | null;
        clipNames: readonly string[];
        x: number | null;
        y: number | null;
        screen: { x: number; y: number } | null;
      };
      enemySentry: () => {
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
      setEnemyDebugView: (enabled: boolean) => void;
      selectedHero: () => HeroId;
      heroRoster: () => readonly string[];
      loadedHeroAssets: () => readonly HeroId[];
      activeTrackId: () => ActiveTrackId | null;
      musicPlayback: () => {
        activeTrackId: ActiveTrackId | null;
        paused: boolean;
        readyState: number;
        errorCode: number | null;
        volume: number;
      };
      musicEnabled: () => boolean;
      memorySafeAssets: () => boolean;
      runtimeQuality: () => RenderQuality;
      heroAssetQuality: () => RenderQuality;
      enemyAssetQuality: () => RenderQuality;
      rendererMemory: () => { geometries: number; textures: number };
      sceneObjectCounts: () => {
        objectives: number;
        enemies: number;
        blockers: number;
        goalInScene: boolean;
        titlePreviewVisible: boolean;
      };
      achievements: () => readonly AchievementProgress[];
      mastery: () => readonly LevelMasteryProgress[];
      encorePick: () => EncorePick | null;
      nextRunTarget: () => NextRunTarget | null;
      refreshReplayProgress: () => {
        achievements: readonly AchievementProgress[];
        mastery: readonly LevelMasteryProgress[];
        encorePick: EncorePick | null;
        nextRunTarget: NextRunTarget | null;
      };
      intelPulse: () => IntelPulseUiState;
      intelPulseVisualStats: () => {
        objects: number;
        meshes: number;
        instancedMeshes: number;
        lines: number;
        instances: number;
      };
      triggerIntelPulse: () => void;
      tutorialState: () => TutorialDebugState;
      setTutorialShot: (shotId: TutorialShotId) => boolean;
      advanceTutorial: () => void;
      skipTutorial: () => void;
      setTutorialSeen: (seen: boolean) => void;
    };
  }
}

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
  private renderer: THREE.WebGLRenderer;
  private readonly input = new InputController();
  private readonly music = new MusicDirector();
  private readonly characterAssets = new CharacterAssetLibrary();
  private readonly objectiveAssets = new ObjectiveAssetLibrary();
  private readonly memorySafeAssets = shouldUseMobileMemorySafeAssets();
  private readonly ui: GameUi;
  private readonly debugPanel: DebugPanel;
  private readonly clock = new THREE.Clock();

  private settings: GameSettings = loadSettings();
  private phase: GamePhase = 'menu';
  private settingsReturnPhase: GamePhase = 'menu';
  private levelSelectReturnPhase: GamePhase = 'menu';
  private loadingProgress: LoadingProgress = { value: 0, label: 'Starting systems' };
  private levelIndex = 0;
  private selectedHeroId: HeroId = defaultHeroId;
  private playerPosition: Vec2 = { ...levels[0].start };
  private readonly titlePreview = new THREE.Group();
  private titleHeroVisual: THREE.Object3D | null = null;
  private titleHeroAnimator: CharacterAnimator | null = null;
  private titlePreviewHeroId: HeroId | null = null;
  private titleHeroPreviewCompact: boolean | null = null;
  private readonly playerMesh = new THREE.Group();
  private playerVisual: THREE.Object3D | null = null;
  private playerAnimator: CharacterAnimator | null = null;
  private readonly playerContactShadow = createContactShadow(0.8, 0.52, 0.28);
  private goalMesh = new THREE.Mesh();
  private goalBeaconMesh = new THREE.Mesh();
  private enemies: EnemyRuntime[] = [];
  private blockers: THREE.Mesh[] = [];
  private objectives: ObjectiveRuntime[] = [];
  private collectedObjectiveIds = new Set<string>();
  private objectiveNotice = '';
  private objectiveNoticeUntil = 0;
  private achievementProgress: readonly AchievementProgress[] = loadAchievementProgress(achievementLevelIds);
  private levelMastery: readonly LevelMasteryProgress[] = loadLevelMasteryProgress(levels);
  private encorePick: EncorePick | null = buildEncorePick(levels, this.levelMastery);
  private nextRunTarget: NextRunTarget | null = buildNextRunTarget(levels, this.levelMastery, this.encorePick);
  private retryTarget: RetryTarget | null = null;
  private achievementNotice = '';
  private achievementNoticeUntil = 0;
  private readonly achievementNoticeQueue: string[] = [];
  private debugRays = new THREE.Group();
  private readonly intelPulseVisuals = new IntelPulseVisuals();
  private intelPulseCharges = intelPulseMaxCharges;
  private intelPulseStartedAt = 0;
  private intelPulseActiveUntil = 0;
  private intelPulseCooldownUntil = 0;
  private intelPulseMobileSimplified = false;
  private intelPulseLastAvailable = true;
  private currentDetection: DetectionState = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
  private currentSuspicion: SuspicionState = emptySuspicion();
  private runStartedAt = 0;
  private runAlertCount = 0;
  private runSummary: RunSummary | null = null;
  private lastHudSecond = -1;
  private latestDebugSample: DebugSample | null = null;
  private renderedFrameCount = 0;
  private shaderWarmupPasses = 0;
  private pickupDebug: PickupDebugSample = emptyPickupDebugSample();
  private pickupFrameProbe: PickupFrameProbe | null = null;
  private qualityMemoryReserve: Float32Array | null = null;
  private reservedMemoryMb = 0;
  private memoryPressureWarned = false;
  private firstLevelBriefingSeen = false;
  private firstRunTutorialSeenSession = false;
  private tutorialUiState: TutorialUiState = inactiveTutorialUiState;
  private tutorialShots: readonly TutorialShot[] = [];
  private tutorialShot: TutorialShot | null = null;
  private tutorialFocusObject: THREE.Object3D | null = null;
  private tutorialShotStartedAt = 0;
  private tutorialShotDurationMs = 1;
  private tutorialAdvanceResolver: (() => void) | null = null;
  private tutorialAdvanceTimeoutId: number | null = null;
  private tutorialSkipRequested = false;
  private readonly tutorialCameraFromPosition = new THREE.Vector3();
  private readonly tutorialCameraFromTarget = new THREE.Vector3();
  private readonly tutorialCameraToPosition = new THREE.Vector3();
  private readonly tutorialCameraToTarget = new THREE.Vector3();
  private readonly tutorialCameraCurrentTarget = new THREE.Vector3();
  private readonly tutorialCameraScratchPosition = new THREE.Vector3();
  private readonly tutorialCameraScratchTarget = new THREE.Vector3();
  private heroDebugView = false;
  private enemyDebugView = false;
  private characterSelectRosterLoadToken = 0;
  private disposed = false;

  constructor(mount: HTMLElement) {
    this.ui = new GameUi(mount, this.settings, {
      onStart: () => void this.start(),
      onBeginBriefing: () => void this.beginBriefedRun(),
      onAdvanceTutorial: () => this.advanceTutorial(),
      onSkipTutorial: () => this.skipTutorial(),
      onSelectHero: (heroId) => this.selectHero(heroId),
      onPreviousHero: () => this.selectAdjacentHero(-1),
      onNextHero: () => this.selectAdjacentHero(1),
      onConfirmHero: () => void this.confirmHeroSelection(),
      onResume: () => void this.resumeFromSettings(),
      onSettings: () => this.openSettings(),
      onGoals: () => this.openGoals(),
      onMenu: () => this.openMenu(),
      onTitle: () => this.returnToTitle(),
      onLevelSelect: () => this.openLevelSelect(),
      onLevelSelectBack: () => this.setPhase(this.levelSelectReturnPhase),
      onSelectLevel: (levelIndex) => void this.selectLevel(levelIndex),
      onRestart: () => void this.retryLevel(),
      onNextLevel: () => void this.nextLevel(),
      onStartOver: () => void this.startOver(),
      onToggleMute: () => void this.toggleMute(),
      onIntelPulse: () => this.triggerIntelPulse(),
      onTouchMove: (movement) => this.input.setVirtualMovement(movement),
      onTouchEnd: () => this.input.clearVirtualMovement(),
      onSettingsChange: (settings) => void this.applySettings(settings),
      onClearData: () => this.clearPlayerData(),
    });
    this.debugPanel = new DebugPanel(this.ui.debug);
    this.renderer = this.createRenderer();
    this.ui.root.appendChild(this.renderer.domElement);
    this.applyRendererQuality();

    this.setupScene();
    this.showTitleScene();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.handleHotkeys);
    this.installDebugHooks();
    if (this.memorySafeAssets) {
      console.info('[performance] mobile memory-safe asset mode enabled');
    }
    console.info('[game] Shadow Circuit initialized');
  }

  run(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleHotkeys);
    this.input.dispose();
    this.music.stop();
    this.clearTitlePreview();
    this.clearLevelObjects();
    this.characterAssets.dispose();
    this.objectiveAssets.dispose();
    this.renderer.dispose();
    this.qualityMemoryReserve = null;
    delete window.__shadowCircuitDebug;
  }

  private async start(): Promise<void> {
    if (this.isTransitioning()) return;

    await this.loadCharacterSelectWithTransition();
    if (this.disposed) return;

    this.setPhase('character-select');
    this.preloadCharacterSelectRosterInBackground();
    await this.music.playMenu(this.settings);
  }

  private async beginBriefedRun(): Promise<void> {
    this.firstLevelBriefingSeen = true;
    await this.startPreparedRun(0);
  }

  private async confirmHeroSelection(): Promise<void> {
    this.releaseCharacterSelectRoster();
    if (this.levelIndex === 0 && !this.firstLevelBriefingSeen) {
      const playFirstRunTutorial = this.shouldPlayFirstRunTutorial();
      this.firstLevelBriefingSeen = true;
      await this.startPreparedRun(0, { playFirstRunTutorial });
      return;
    }

    await this.startPreparedRun(this.levelIndex);
  }

  private selectHero(heroId: HeroId): void {
    if (!isHeroId(heroId)) return;

    this.selectedHeroId = heroId;
    this.installTitleHeroPreview(heroId);
    void this.prepareTitlePreview();
    this.fitCameraToTitle();
    this.renderUi();
    console.info(`[hero] selected ${heroId}`);
  }

  private selectAdjacentHero(direction: -1 | 1): void {
    const currentIndex = heroOptions.findIndex((hero) => hero.id === this.selectedHeroId);
    const nextIndex = (Math.max(0, currentIndex) + direction + heroOptions.length) % heroOptions.length;
    this.selectHero(heroOptions[nextIndex].id);
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (!isPlayingPhase(phase)) {
      this.input.clearVirtualMovement();
    }
    if (phase === 'menu' || phase === 'character-select') {
      this.fitCameraToTitle();
    }
    this.renderUi();
    console.info(`[game] phase=${phase} level=${this.level.id}`);
  }

  private openSettings(): void {
    if (this.isTransitioning()) return;

    this.settingsReturnPhase = this.phase === 'settings' ? this.settingsReturnPhase : this.phase;
    this.setPhase('settings');
  }

  private openGoals(): void {
    if (this.isTransitioning()) return;

    this.showTitleScene();
    this.setPhase('goals');
    void this.music.playMenu(this.settings);
  }

  private async resumeFromSettings(): Promise<void> {
    this.setPhase(this.settingsReturnPhase);
    await this.syncMusicForCurrentPhase();
  }

  private openMenu(): void {
    if (this.isTransitioning()) return;

    this.releaseCharacterSelectRoster();
    this.showTitleScene();
    this.setPhase('menu');
    void this.music.playMenu(this.settings);
  }

  private openLevelSelect(): void {
    if (this.isTransitioning()) return;

    this.levelSelectReturnPhase = this.phase === 'level-select' ? this.levelSelectReturnPhase : this.phase;
    this.setPhase('level-select');
  }

  private async applySettings(settings: GameSettings): Promise<void> {
    const audioChanged =
      this.settings.musicEnabled !== settings.musicEnabled ||
      this.settings.masterVolume !== settings.masterVolume ||
      this.settings.soundtrackId !== settings.soundtrackId;
    const qualityChanged = this.settings.quality !== settings.quality;
    const previousRendererQuality = this.rendererQuality();
    const previousHeroQuality = this.heroAssetQuality();
    const previousEnemyQuality = this.enemyAssetQuality();
    const previousObjectiveQuality = this.objectiveAssetQuality();

    this.settings = settings;
    this.ui.setSettings(settings);
    saveSettings(settings);
    this.applyRendererQuality();
    if (
      qualityChanged ||
      previousRendererQuality !== this.rendererQuality() ||
      previousHeroQuality !== this.heroAssetQuality() ||
      previousEnemyQuality !== this.enemyAssetQuality() ||
      previousObjectiveQuality !== this.objectiveAssetQuality()
    ) {
      if (this.hasActiveLevelScene()) {
        if (this.objectiveAssetQuality() !== 'cinematic' || this.objectiveAssets.hasCinematicAssets()) {
          this.rebuildObjectiveMeshes();
        }
        const canRebuildHero = this.heroAssetQuality() !== 'cinematic' || this.characterAssets.hasHeroCinematicAsset(this.selectedHeroId);
        const canRebuildEnemy = this.enemyAssetQuality() !== 'cinematic' || this.characterAssets.hasCinematicAssets(this.selectedHeroId);
        if (canRebuildHero && canRebuildEnemy) {
          this.rebuildCharacterMeshes();
        }
      } else if (this.hasTitlePreviewScene()) {
        this.installTitleHeroPreview(this.selectedHeroId);
        void this.prepareTitlePreview();
        this.fitCameraToTitle();
      }
    }
    if (audioChanged) {
      await this.music.warmupEffects(settings);
      await this.syncMusicForCurrentPhase();
    }
    this.renderUi();
    console.info(`[settings] quality=${settings.quality} music=${settings.musicEnabled} debug=${settings.debugEnabled}`);
  }

  private async toggleMute(): Promise<void> {
    await this.applySettings({ ...this.settings, musicEnabled: !this.settings.musicEnabled });
  }

  private clearPlayerData(): void {
    clearPlayerStorageData();
    clearVersionedFeatureRecords();
    this.firstLevelBriefingSeen = false;
    this.firstRunTutorialSeenSession = false;
    this.achievementNotice = '';
    this.achievementNoticeUntil = 0;
    this.achievementNoticeQueue.length = 0;
    this.retryTarget = null;
    this.refreshReplayProgress();
    this.renderUi();
    console.info('[settings] player data cleared');
  }

  private restartLevel(): void {
    this.playerPosition = { ...this.level.start };
    this.playerMesh.position.set(this.playerPosition.x, 0.48, this.playerPosition.z);
    this.playerContactShadow.position.set(this.playerPosition.x, 0.016, this.playerPosition.z);
    this.enemies.forEach((enemy) => {
      enemy.position = { ...enemy.spec.start };
      enemy.facing = normalize(subtract(enemy.spec.patrol[1] ?? enemy.spec.start, enemy.spec.start));
      enemy.patrolIndex = 1;
      enemy.pauseRemaining = 0;
      this.placeEnemy(enemy);
    });
    this.currentDetection = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
    this.currentSuspicion = emptySuspicion();
    this.heroDebugView = false;
    this.enemyDebugView = false;
    this.runStartedAt = 0;
    this.runAlertCount = 0;
    this.runSummary = null;
    this.lastHudSecond = -1;
    this.collectedObjectiveIds.clear();
    this.objectiveNotice = '';
    this.objectiveNoticeUntil = 0;
    this.resetIntelPulseForRun();
    this.updateObjectiveMeshes();
    console.info(`[level] restarted ${this.level.id}`);
  }

  private async retryLevel(): Promise<void> {
    await this.startPreparedRun(this.levelIndex);
  }

  private async nextLevel(): Promise<void> {
    if (this.isTransitioning()) return;

    if (this.levelIndex >= levels.length - 1) {
      this.returnToTitle();
      return;
    }

    await this.startPreparedRun(this.levelIndex + 1);
  }

  private returnToTitle(): void {
    if (this.isTransitioning()) return;

    this.releaseCharacterSelectRoster();
    this.showTitleScene();
    this.setPhase('menu');
    void this.music.playMenu(this.settings);
  }

  private async startOver(): Promise<void> {
    await this.startPreparedRun(0);
  }

  private async selectLevel(levelIndex: number): Promise<void> {
    await this.startPreparedRun(levelIndex);
  }

  private async startPreparedRun(levelIndex: number, options: StartRunOptions = {}): Promise<void> {
    if (this.isTransitioning()) return;

    await this.loadLevelWithTransition(levelIndex);
    if (this.disposed) return;

    if (options.playFirstRunTutorial) {
      await this.playFirstRunTutorial();
      if (this.disposed) return;
    }

    this.beginRun();
    this.setPhase('playing');
    await this.music.warmupEffects(this.settings);
    await this.music.sync(this.settings, soundtrackIdForLevel(this.levelIndex));
  }

  private async playFirstRunTutorial(): Promise<void> {
    this.markFirstRunTutorialSeen(true);
    this.tutorialSkipRequested = false;
    this.heroDebugView = false;
    this.enemyDebugView = false;
    this.tutorialShots = this.buildFirstRunTutorialShots();
    this.tutorialCameraCurrentTarget.set(0, 0, 0);
    void this.music.sync(this.settings, soundtrackIdForLevel(this.levelIndex));

    this.setPhase('tutorial');

    for (let index = 0; index < this.tutorialShots.length; index += 1) {
      if (this.disposed || this.tutorialSkipRequested) break;

      const shot = this.tutorialShots[index];
      this.startTutorialShot(shot, index, this.tutorialShots.length);
      await this.waitForTutorialStep(shot.durationMs);
    }

    this.finishFirstRunTutorial();
  }

  private buildFirstRunTutorialShots(): readonly TutorialShot[] {
    const shots: TutorialShot[] = [];
    const keycard = this.objectives.find((objective) => objective.spec.type === 'keycard') ?? this.objectives[0] ?? null;
    const terminal =
      this.objectives.find((objective) => objective.spec.type === 'terminal') ??
      this.objectives.find((objective) => objective !== keycard) ??
      null;
    const enemy = this.enemies[0] ?? null;
    const heroTarget = new THREE.Vector3(this.playerPosition.x, 0.86, this.playerPosition.z);

    shots.push({
      id: 'hero',
      title: heroOptions.find((hero) => hero.id === this.selectedHeroId)?.name ?? 'Operative',
      body: 'This is your operative. Move quietly, use cover, and wait for clean patrol windows before crossing open space.',
      target: heroTarget,
      camera: heroTarget.clone().add(new THREE.Vector3(1.25, 1.14, 0.78)),
      focus: this.playerMesh,
      durationMs: 4600,
    });

    if (enemy) {
      const target = new THREE.Vector3(enemy.position.x, enemy.mesh.position.y + 0.48, enemy.position.z);
      const side = new THREE.Vector3(enemy.facing.z, 0, -enemy.facing.x);
      const facing = new THREE.Vector3(enemy.facing.x, 0, enemy.facing.z);
      shots.push({
        id: 'sentry',
        title: 'Sentries',
        body: 'Sentries sweep fixed routes. Their front lens projects the warning cone, and getting caught in it raises suspicion fast.',
        target,
        camera: target.clone().add(facing.multiplyScalar(2.05)).add(side.multiplyScalar(2.15)).add(new THREE.Vector3(0, 1.45, 0)),
        focus: enemy.mesh,
        durationMs: 5000,
      });
    }

    if (keycard) {
      const target = new THREE.Vector3(keycard.spec.position.x, 0.34, keycard.spec.position.z);
      shots.push({
        id: 'keycard',
        title: 'Access Cards',
        body: 'Yellow keycards are required pickups. Collect every required card before you commit to the exit route.',
        target,
        camera: target.clone().add(new THREE.Vector3(0.78, 1.22, 2.05)),
        focus: keycard.mesh,
        durationMs: 4400,
      });
    }

    if (terminal && terminal !== keycard) {
      const target = new THREE.Vector3(terminal.spec.position.x, 0.42, terminal.spec.position.z);
      shots.push({
        id: 'terminal',
        title: 'Terminals',
        body: 'Blue terminals complete the access chain. Once the required cards and terminals are secured, the exit unlocks.',
        target,
        camera: target.clone().add(new THREE.Vector3(-0.86, 1.26, 2.1)),
        focus: terminal.mesh,
        durationMs: 4400,
      });
    }

    const goalTarget = new THREE.Vector3(this.level.goal.x, 0.38, this.level.goal.z);
    shots.push(
      {
        id: 'goal',
        title: 'Exit Pad',
        body: 'The exit pad turns green after the required objectives are complete. Reach it to finish the level.',
        target: goalTarget,
        camera: goalTarget.clone().add(new THREE.Vector3(0.72, 1.55, 2.25)),
        focus: this.goalMesh,
        durationMs: 4400,
      },
      {
        id: 'good-luck',
        title: 'Good luck, cadet.',
        body: 'The route is live. Stay low, think ahead, and move when the sentries turn away.',
        target: new THREE.Vector3(0, 0, 0),
        camera: this.standardLevelCameraPosition(),
        focus: this.playerMesh,
        durationMs: 3600,
        final: true,
      },
    );

    return shots;
  }

  private startTutorialShot(shot: TutorialShot, index: number, total: number, immediate = false): void {
    const now = performance.now();
    this.tutorialShot = shot;
    this.tutorialFocusObject = shot.focus;
    this.tutorialShotStartedAt = now;
    this.tutorialShotDurationMs = Math.max(1, shot.durationMs);
    this.tutorialCameraFromPosition.copy(immediate ? shot.camera : this.camera.position);
    this.tutorialCameraFromTarget.copy(immediate ? shot.target : this.tutorialCameraCurrentTarget);
    this.tutorialCameraToPosition.copy(shot.camera);
    this.tutorialCameraToTarget.copy(shot.target);
    this.tutorialUiState = {
      active: true,
      step: shot.id,
      title: shot.title,
      body: shot.body,
      progress: total <= 0 ? 1 : (index + 1) / total,
      final: Boolean(shot.final),
    };
    this.updateTutorialCamera(now, immediate);
    this.renderUi();
  }

  private updateTutorialCamera(now: number, immediate = false): void {
    if (this.phase !== 'tutorial' || !this.tutorialShot) return;

    const progress = immediate
      ? 1
      : easeInOutCubic(clamp01((now - this.tutorialShotStartedAt) / Math.min(tutorialEaseDurationMs, this.tutorialShotDurationMs)));
    this.tutorialCameraScratchPosition.lerpVectors(this.tutorialCameraFromPosition, this.tutorialCameraToPosition, progress);
    this.tutorialCameraScratchTarget.lerpVectors(this.tutorialCameraFromTarget, this.tutorialCameraToTarget, progress);
    this.camera.position.copy(this.tutorialCameraScratchPosition);
    this.camera.lookAt(this.tutorialCameraScratchTarget);
    this.tutorialCameraCurrentTarget.copy(this.tutorialCameraScratchTarget);

    if (this.scene.fog instanceof THREE.Fog) {
      if (this.tutorialShot.final) {
        const scale = this.levelCameraScale();
        this.scene.fog.near = 8 * scale;
        this.scene.fog.far = 22 * scale;
      } else {
        this.scene.fog.near = 2.4;
        this.scene.fog.far = 12;
      }
    }
  }

  private waitForTutorialStep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        this.clearTutorialAdvanceTimeout();
        if (this.tutorialAdvanceResolver === finish) {
          this.tutorialAdvanceResolver = null;
        }
        resolve();
      };
      this.tutorialAdvanceResolver = finish;
      this.scheduleTutorialAdvance(finish, durationMs);
    });
  }

  private scheduleTutorialAdvance(finish: () => void, durationMs: number): void {
    this.clearTutorialAdvanceTimeout();
    this.tutorialAdvanceTimeoutId = window.setTimeout(finish, durationMs);
  }

  private clearTutorialAdvanceTimeout(): void {
    if (this.tutorialAdvanceTimeoutId === null) return;

    window.clearTimeout(this.tutorialAdvanceTimeoutId);
    this.tutorialAdvanceTimeoutId = null;
  }

  private advanceTutorial(): void {
    if (this.phase !== 'tutorial') return;

    this.tutorialAdvanceResolver?.();
  }

  private skipTutorial(): void {
    if (this.phase !== 'tutorial') return;

    this.tutorialSkipRequested = true;
    this.tutorialAdvanceResolver?.();
  }

  private finishFirstRunTutorial(): void {
    this.tutorialAdvanceResolver = null;
    this.clearTutorialAdvanceTimeout();
    this.tutorialSkipRequested = false;
    this.tutorialShots = [];
    this.tutorialShot = null;
    this.tutorialFocusObject = null;
    this.tutorialUiState = inactiveTutorialUiState;
    this.fitCameraToLevel();
  }

  private shouldPlayFirstRunTutorial(): boolean {
    return (
      this.levelIndex === 0 &&
      this.isFirstRunTutorialViewportEligible() &&
      !this.hasSeenFirstRunTutorial()
    );
  }

  private isFirstRunTutorialViewportEligible(): boolean {
    const bounds = this.ui.root.getBoundingClientRect();
    const width = Math.max(bounds.width, bounds.height);
    const height = Math.min(bounds.width, bounds.height);
    const aspect = width / Math.max(1, height);
    return (
      width >= 1000 &&
      height >= 620 &&
      aspect >= 1.2 &&
      aspect <= 1.9
    );
  }

  private hasSeenFirstRunTutorial(): boolean {
    if (this.firstRunTutorialSeenSession) return true;

    try {
      if (window.localStorage.getItem(legacyFirstRunTutorialStorageKey) === 'seen') {
        return true;
      }
    } catch {
      return true;
    }
    return !shouldShowVersionedFeature(firstRunCinematicTutorialFeature);
  }

  private markFirstRunTutorialSeen(seen: boolean): void {
    this.firstRunTutorialSeenSession = seen;
    if (seen) {
      markVersionedFeatureSeen(firstRunCinematicTutorialFeature);
    }
    try {
      if (seen) {
        window.localStorage.setItem(legacyFirstRunTutorialStorageKey, 'seen');
      } else {
        window.localStorage.removeItem(legacyFirstRunTutorialStorageKey);
        clearVersionedFeatureRecords();
      }
    } catch {
      // Storage can be unavailable in private or quota-limited browser sessions.
    }
  }

  private async loadCharacterSelectWithTransition(): Promise<void> {
    this.loadingProgress = { value: 0, label: 'Loading selected operative' };
    this.setPhase('loading');

    await runLoadingSequence({
      tasks: [
        { label: 'Loading menu music', run: () => this.music.preloadMenuTrack() },
        { label: 'Loading selected operative', run: () => this.preloadCharacterSelectAssets() },
        { label: 'Preparing selected operative', run: () => this.prepareTitlePreview() },
      ],
      onProgress: (progress) => this.updateLoadingProgress(progress),
      shouldCancel: () => this.disposed,
      minDurationMs: 1100,
      minTaskMs: 180,
      readyDelayMs: 150,
    });
  }

  private async loadLevelWithTransition(levelIndex: number): Promise<void> {
    const targetIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
    const targetLevel = levels[targetIndex];
    this.loadingProgress = { value: 0, label: `Loading ${targetLevel.name}` };
    this.prepareBlackLoadingScene();
    this.setPhase('loading');

    await runLoadingSequence({
      tasks: this.levelTransitionTasks(targetIndex),
      onProgress: (progress) => this.updateLoadingProgress(progress),
      shouldCancel: () => this.disposed,
      minDurationMs: 950,
      minTaskMs: 150,
      readyDelayMs: 0,
    });
  }

  private levelTransitionTasks(levelIndex: number): readonly LoadingTask[] {
    const targetLevel = levels[levelIndex];
    return [
      { label: 'Loading character assets', run: () => this.preloadCharacterAssets() },
      { label: 'Loading objective assets', run: () => this.objectiveAssets.preload(this.objectiveAssetQuality()) },
      { label: `Loading ${targetLevel.name}`, run: () => this.loadLevel(levelIndex) },
      { label: 'Loading soundtrack', run: () => this.music.preload(this.settings, soundtrackIdForLevel(levelIndex)) },
      { label: 'Compiling level materials', run: () => this.warmupRenderStates() },
      { label: 'Priming intel pulse', run: () => this.warmupIntelPulse() },
      { label: 'Priming objective states', run: () => this.warmupObjectiveStates() },
      { label: 'Warming pickup audio', run: () => this.music.warmupEffects(this.settings) },
      { label: 'Simulating collectible pickups', run: () => this.warmupPickupCollections() },
    ];
  }

  private async preloadCharacterSelectAssets(): Promise<void> {
    if (this.heroAssetQuality() !== 'cinematic') {
      return;
    }

    try {
      await withTimeout(this.characterAssets.preloadHero(this.selectedHeroId), 12000);
    } catch (error: unknown) {
      console.warn(`[assets] selected hero preview timed out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private preloadCharacterSelectRosterInBackground(): void {
    if (this.heroAssetQuality() !== 'cinematic') {
      return;
    }

    const token = ++this.characterSelectRosterLoadToken;
    const orderedHeroIds = [
      this.selectedHeroId,
      ...heroOptions.map((hero) => hero.id).filter((heroId) => heroId !== this.selectedHeroId),
    ];

    void (async () => {
      for (const heroId of orderedHeroIds) {
        if (!this.shouldContinueCharacterSelectRosterLoad(token)) return;

        try {
          await withTimeout(this.characterAssets.preloadHero(heroId), 18000);
        } catch (error: unknown) {
          console.warn(`[assets] background hero preload skipped ${heroId}: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!this.shouldContinueCharacterSelectRosterLoad(token)) {
          this.characterAssets.releaseUnselectedHeroes(this.selectedHeroId);
          return;
        }
        if (heroId === this.selectedHeroId) {
          void this.prepareTitlePreview();
        }
      }
    })();
  }

  private shouldContinueCharacterSelectRosterLoad(token: number): boolean {
    return !this.disposed && this.phase === 'character-select' && token === this.characterSelectRosterLoadToken;
  }

  private releaseCharacterSelectRoster(): void {
    this.characterSelectRosterLoadToken += 1;
    this.characterAssets.releaseUnselectedHeroes(this.selectedHeroId);
  }

  private async preloadCharacterAssets(): Promise<void> {
    if (!this.memorySafeAssets) {
      await this.characterAssets.preload(this.settings.quality, this.selectedHeroId);
      return;
    }

    if (this.heroAssetQuality() === 'cinematic') {
      await this.characterAssets.preloadHero(this.selectedHeroId);
    }
  }

  private prepareBlackLoadingScene(): void {
    this.clearTitlePreview();
    this.clearLevelObjects();
    this.scene.background = new THREE.Color('#000000');
    this.scene.fog = null;
    this.renderer.render(this.scene, this.camera);
  }

  private showTitleScene(): void {
    this.levelIndex = 0;
    this.clearLevelObjects();
    this.scene.background = new THREE.Color('#000000');
    this.scene.fog = null;
    this.titlePreview.visible = true;
    if (!this.scene.children.includes(this.titlePreview)) {
      this.scene.add(this.titlePreview);
    }
    this.playerPosition = { ...this.level.start };
    this.collectedObjectiveIds.clear();
    this.currentDetection = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
    this.currentSuspicion = emptySuspicion();
    this.runStartedAt = 0;
    this.runAlertCount = 0;
    this.runSummary = null;
    this.objectiveNotice = '';
    this.objectiveNoticeUntil = 0;
    this.fitCameraToTitle();
    this.music.preloadMenuTrack();
    void this.prepareTitlePreview();
    void this.music.playMenu(this.settings);
    this.renderUi();
  }

  private async prepareTitlePreview(): Promise<void> {
    const heroId = this.selectedHeroId;
    const alreadyReady =
      this.titleHeroVisual &&
      this.titlePreviewHeroId === heroId &&
      (this.heroAssetQuality() !== 'cinematic' || this.titleHeroAnimator !== null);
    if (alreadyReady) return;

    if (this.heroAssetQuality() === 'cinematic') {
      await this.characterAssets.preloadHero(heroId);
      if (this.disposed || this.selectedHeroId !== heroId) return;
    }

    this.installTitleHeroPreview(heroId);
    if (this.phase === 'menu' || this.phase === 'character-select') {
      this.fitCameraToTitle();
    }
  }

  private installTitleHeroPreview(heroId: HeroId = this.selectedHeroId): void {
    this.clearTitlePreview();
    this.titlePreview.name = 'title-preview';

    const platformMaterial = new THREE.MeshBasicMaterial({ color: '#020405', depthWrite: false, transparent: true, opacity: 0.64 });
    const platform = new THREE.Mesh(new THREE.CircleGeometry(1.04, 48), platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.position.set(titleHeroBaseX, titleHeroBaseY - 0.02, 0);
    platform.name = 'title-hero-platform';
    platform.renderOrder = -2;

    const compactPreview = this.useCompactTitleHeroPreview();
    const operationStage = createTitleOperationStage(this.titleHeroPreviewX(), compactPreview);
    const key = new THREE.DirectionalLight('#e7fbff', compactPreview ? 2.4 : 5.2);
    key.position.set(2.7, 3.6, 3.2);
    key.name = 'title-hero-key-light';

    const ambient = new THREE.HemisphereLight('#e7fbff', '#172331', 2.2);
    ambient.name = 'title-hero-ambient-light';

    const rim = new THREE.PointLight('#53ffe2', compactPreview ? 2.4 : 5.6, 4.8);
    rim.position.set(0.55, 1.35, 1.35);
    rim.name = 'title-hero-rim-light';

    const fill = new THREE.PointLight('#fff2d0', compactPreview ? 1.8 : 4.6, 4.4);
    fill.position.set(1.35, 1.15, 2.15);
    fill.name = 'title-hero-fill-light';

    const character = this.characterAssets.createHero(this.heroAssetQuality(), heroId);
    this.titleHeroVisual = character.object;
    this.titleHeroAnimator = character.animator;
    this.titleHeroAnimator?.setMotionState('idle', 0);
    this.titleHeroVisual.name = `title-hero:${heroId}:${this.titleHeroAnimator ? 'cinematic' : 'simple'}`;
    this.titlePreviewHeroId = heroId;
    this.titleHeroPreviewCompact = compactPreview;
    prepareTitleHeroPreviewMaterials(this.titleHeroVisual, compactPreview);
    this.titleHeroVisual.position.set(titleHeroBaseX, titleHeroBaseY, 0);
    this.titleHeroVisual.rotation.y = -0.26;
    this.titleHeroVisual.scale.multiplyScalar(compactPreview ? compactCharacterSelectHeroScale : 1);

    this.titlePreview.add(operationStage, platform, key, ambient, rim, fill, this.titleHeroVisual);
    this.layoutTitleHeroPreview();
  }

  private syncTitleHeroPreviewPresentation(): void {
    if (!this.titleHeroVisual || this.titlePreviewHeroId !== this.selectedHeroId) return;

    const compactPreview = this.useCompactTitleHeroPreview();
    if (this.titleHeroPreviewCompact !== compactPreview) {
      this.installTitleHeroPreview(this.selectedHeroId);
    }
  }

  private layoutTitleHeroPreview(): void {
    const x = this.titleHeroPreviewX();
    const platform = this.titlePreview.getObjectByName('title-hero-platform');
    const y = this.titleHeroPreviewY();
    if (this.titleHeroVisual) {
      this.titleHeroVisual.position.x = x;
      this.titleHeroVisual.position.y = y;
    }
    if (platform) {
      platform.position.x = x;
      platform.position.y = this.titleHeroPlatformY(y);
    }
  }

  private titleHeroPreviewX(): number {
    if (this.phase !== 'character-select') return titleHeroMenuBaseX;
    return this.isCompactLandscapeViewport() ? compactCharacterSelectHeroBaseX : characterSelectHeroBaseX;
  }

  private titleHeroPreviewY(): number {
    return this.useCompactTitleHeroPreview() ? compactCharacterSelectHeroBaseY : titleHeroBaseY;
  }

  private useCompactTitleHeroPreview(): boolean {
    return this.phase === 'character-select' && this.isCompactLandscapeViewport();
  }

  private titleHeroPlatformY(fallbackY: number): number {
    if (!this.titleHeroVisual) return fallbackY - 0.02;

    this.titleHeroVisual.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.titleHeroVisual);
    return Number.isFinite(bounds.min.y) ? bounds.min.y + 0.015 : fallbackY - 0.02;
  }

  private updateTitlePreviewAtmosphere(time: number): void {
    const sweep = this.titlePreview.getObjectByName('title-patrol-sweep');
    if (sweep) {
      sweep.rotation.y = -0.18 + Math.sin(time * 0.85) * 0.26;
    }

    const pulse = this.titlePreview.getObjectByName('title-objective-pulse');
    if (pulse) {
      const scale = 1 + Math.sin(time * 2.4) * 0.08;
      pulse.scale.set(scale, scale, scale);
    }
  }

  private isCompactLandscapeViewport(): boolean {
    const bounds = this.ui.root.getBoundingClientRect();
    return bounds.width > bounds.height && bounds.width <= 960 && bounds.height <= 500;
  }

  private shouldShowObjectiveNotice(): boolean {
    return !this.isMobileInterface();
  }

  private isMobileInterface(): boolean {
    return this.memorySafeAssets || window.matchMedia('(pointer: coarse)').matches || this.isCompactLandscapeViewport();
  }

  private loadLevel(index: number): void {
    this.titlePreview.visible = false;
    this.scene.remove(this.titlePreview);
    this.scene.background = new THREE.Color('#03050a');
    this.scene.fog = new THREE.Fog('#03050a', 8, 22);
    this.levelIndex = index;
    this.clearLevelObjects();
    const level = this.level;
    this.playerPosition = { ...level.start };

    const floor = new THREE.Mesh(new THREE.BoxGeometry(level.floorSize.x, 0.12, level.floorSize.z), createFloorShaderMaterial());
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);
    this.scene.add(this.createFloorTiles(level));

    const wallMaterial = new THREE.MeshStandardMaterial({ color: '#05070b', roughness: 0.78 });
    const wallGeometryX = new THREE.BoxGeometry(level.floorSize.x, 1.8, 0.18);
    const wallGeometryZ = new THREE.BoxGeometry(0.18, 1.8, level.floorSize.z);
    const walls = [
      new THREE.Mesh(wallGeometryX, wallMaterial),
      new THREE.Mesh(wallGeometryX, wallMaterial),
      new THREE.Mesh(wallGeometryZ, wallMaterial),
      new THREE.Mesh(wallGeometryZ, wallMaterial),
    ];
    walls[0].position.set(0, 0.84, -level.floorSize.z / 2);
    walls[1].position.set(0, 0.84, level.floorSize.z / 2);
    walls[2].position.set(-level.floorSize.x / 2, 0.84, 0);
    walls[3].position.set(level.floorSize.x / 2, 0.84, 0);
    walls.forEach((wall) => {
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.name = 'level-object';
      this.scene.add(wall);
    });

    for (const obstacle of level.obstacles) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(obstacle.size.x, obstacle.height, obstacle.size.z),
        new THREE.MeshStandardMaterial({ color: '#252d39', roughness: 0.68, metalness: 0.12 }),
      );
      mesh.position.set(obstacle.center.x, obstacle.height / 2, obstacle.center.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `blocker:${obstacle.id}`;
      this.scene.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: '#5f7896', transparent: true, opacity: 0.42 }),
      );
      edges.position.copy(mesh.position);
      edges.name = `blocker-edge:${obstacle.id}`;
      this.scene.add(edges);
      this.blockers.push(mesh);
    }

    for (const light of level.lights) {
      const point = new THREE.PointLight(light.color, light.intensity, light.radius);
      point.position.set(light.position.x, light.height, light.position.z);
      point.castShadow = this.rendererQuality() !== 'memory';
      point.shadow.mapSize.setScalar(qualityProfile(this.rendererQuality()).shadowMapSize);
      point.name = `light:${light.id}`;
      this.scene.add(point);

      this.scene.add(this.createLightFixture(light));
    }

    this.objectives = (level.objectives ?? []).map((objective) => this.createObjective(objective));
    this.objectives.forEach((objective) => {
      this.scene.add(objective.mesh, objective.glow);
    });

    this.goalMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(level.goalRadius, level.goalRadius, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: '#7dff9b', emissive: '#1a6f34', emissiveIntensity: 0.85 }),
    );
    this.goalMesh.position.set(level.goal.x, 0.08, level.goal.z);
    this.goalMesh.name = 'goal';
    this.scene.add(this.goalMesh);
    this.goalBeaconMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(level.goalRadius * 0.58, level.goalRadius * 0.58, 0.95, 32, 1, true),
      createGoalBeaconMaterial(),
    );
    this.goalBeaconMesh.position.set(level.goal.x, 0.52, level.goal.z);
    this.goalBeaconMesh.name = 'goal-beacon';
    this.scene.add(this.goalBeaconMesh);

    this.refreshPlayerVisual();
    this.playerMesh.castShadow = true;
    this.playerMesh.name = 'player';
    this.scene.add(this.playerMesh, this.playerContactShadow);

    this.enemies = level.enemies.map((enemy) => this.createEnemy(enemy));
    this.enemies.forEach((enemy) => {
      this.scene.add(enemy.mesh, enemy.cone, enemy.light, enemy.lens, enemy.contactShadow);
      this.placeEnemy(enemy);
    });

    this.restartLevel();
    this.fitCameraToLevel();
    this.renderUi();
    console.info(`[level] loaded ${level.id} blockers=${this.blockers.length} enemies=${this.enemies.length}`);
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color('#03050a');
    this.scene.fog = new THREE.Fog('#03050a', 8, 22);
    this.camera.position.set(0, 10.2, 10.4);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight('#253044', 0.18);
    this.scene.add(ambient);
    this.scene.add(this.debugRays);
    this.scene.add(this.intelPulseVisuals.group);
  }

  private createFloorTiles(level: LevelDefinition): THREE.InstancedMesh {
    const columns = Math.floor(level.floorSize.x);
    const rows = Math.floor(level.floorSize.z);
    const geometry = new THREE.BoxGeometry(0.92, 0.018, 0.92);
    const material = new THREE.MeshStandardMaterial({
      color: '#141c28',
      roughness: 0.92,
      metalness: 0.05,
    });
    const tiles = new THREE.InstancedMesh(geometry, material, columns * rows);
    const matrix = new THREE.Matrix4();
    let index = 0;

    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const x = -level.floorSize.x / 2 + 0.5 + column;
        const z = -level.floorSize.z / 2 + 0.5 + row;
        matrix.makeTranslation(x, 0.002, z);
        tiles.setMatrixAt(index, matrix);
        index += 1;
      }
    }

    tiles.receiveShadow = true;
    tiles.name = 'floor-detail';
    return tiles;
  }

  private createRenderer(): THREE.WebGLRenderer {
    const profile = qualityProfile(this.rendererQuality());
    const renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(profile.pixelRatio);
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
  }

  private updateLoadingProgress(progress: LoadingProgress): void {
    this.loadingProgress = progress;
    this.renderUi();
  }

  private async warmupRenderStates(): Promise<void> {
    const previousGoalBeaconVisible = this.goalBeaconMesh.visible;
    const previousObjectiveVisibility = this.objectives.map((objective) => ({
      mesh: objective.mesh.visible,
      glow: objective.glow.visible,
    }));

    this.goalBeaconMesh.visible = true;
    for (const objective of this.objectives) {
      objective.mesh.visible = true;
      objective.glow.visible = true;
    }
    await this.renderer.compileAsync(this.scene, this.camera);
    this.shaderWarmupPasses += 1;
    this.renderer.render(this.scene, this.camera);

    this.goalBeaconMesh.visible = previousGoalBeaconVisible;
    this.objectives.forEach((objective, index) => {
      objective.mesh.visible = previousObjectiveVisibility[index]?.mesh ?? objective.mesh.visible;
      objective.glow.visible = previousObjectiveVisibility[index]?.glow ?? objective.glow.visible;
    });
    await this.renderer.compileAsync(this.scene, this.camera);
    this.shaderWarmupPasses += 1;
  }

  private async warmupIntelPulse(): Promise<void> {
    this.rebuildIntelPulseVisuals(true);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.shaderWarmupPasses += 1;
    this.renderer.render(this.scene, this.camera);
    this.clearIntelPulseVisuals();
  }

  private warmupObjectiveStates(): void {
    const previousCollectedIds = new Set(this.collectedObjectiveIds);
    const previousNotice = this.objectiveNotice;
    const previousNoticeUntil = this.objectiveNoticeUntil;

    for (const objective of this.level.objectives ?? []) {
      this.collectedObjectiveIds.add(objective.id);
    }
    this.updateObjectiveMeshes();
    this.renderUi();
    this.renderer.render(this.scene, this.camera);

    this.collectedObjectiveIds = previousCollectedIds;
    this.objectiveNotice = previousNotice;
    this.objectiveNoticeUntil = previousNoticeUntil;
    this.updateObjectiveMeshes();
    this.renderUi();
  }

  private warmupPickupCollections(): void {
    const objectives = this.level.objectives ?? [];
    if (objectives.length === 0) return;

    const previousPhase = this.phase;
    const previousPlayerPosition = { ...this.playerPosition };
    const previousPlayerMeshPosition = this.playerMesh.position.clone();
    const previousContactShadowPosition = this.playerContactShadow.position.clone();
    const previousCollectedIds = new Set(this.collectedObjectiveIds);
    const previousNotice = this.objectiveNotice;
    const previousNoticeUntil = this.objectiveNoticeUntil;
    const previousPickupDebug = this.pickupDebug;
    const previousPickupFrameProbe = this.pickupFrameProbe;
    const previousRunStartedAt = this.runStartedAt;
    const previousLastHudSecond = this.lastHudSecond;

    this.phase = 'playing';
    this.runStartedAt = performance.now();
    for (const objective of objectives) {
      this.playerPosition = { ...objective.position };
      this.playerMesh.position.set(objective.position.x, 0.48, objective.position.z);
      this.playerContactShadow.position.set(objective.position.x, 0.016, objective.position.z);
      this.collectObjectives({
        audioSettings: this.pickupWarmupSettings(),
        recordDebug: false,
        startFrameProbe: false,
        log: false,
        logAudio: false,
      });
      this.renderer.render(this.scene, this.camera);
    }

    this.phase = previousPhase;
    this.playerPosition = previousPlayerPosition;
    this.playerMesh.position.copy(previousPlayerMeshPosition);
    this.playerContactShadow.position.copy(previousContactShadowPosition);
    this.collectedObjectiveIds = previousCollectedIds;
    this.objectiveNotice = previousNotice;
    this.objectiveNoticeUntil = previousNoticeUntil;
    this.pickupDebug = previousPickupDebug;
    this.pickupFrameProbe = previousPickupFrameProbe;
    this.runStartedAt = previousRunStartedAt;
    this.lastHudSecond = previousLastHudSecond;
    this.updateObjectiveMeshes();
    this.renderUi();
    this.renderer.render(this.scene, this.camera);
  }

  private triggerIntelPulse(): void {
    const now = performance.now();
    if (!this.canTriggerIntelPulse(now)) return;

    this.intelPulseCharges = Math.max(0, this.intelPulseCharges - 1);
    this.intelPulseStartedAt = now;
    this.intelPulseActiveUntil = now + intelPulseDurationMs;
    this.intelPulseCooldownUntil = now + intelPulseCooldownMs;
    this.intelPulseMobileSimplified = this.isMobileInterface();
    this.rebuildIntelPulseVisuals(!this.intelPulseMobileSimplified);
    this.intelPulseLastAvailable = false;
    this.renderUi();
    const plan = this.intelPulseVisuals.plan;
    console.info(
      `[intel] pulse active objectives=${plan?.objectiveMarkers.length ?? 0} patrols=${plan?.patrolRoutes.length ?? 0} mobile=${this.intelPulseMobileSimplified}`,
    );
  }

  private canTriggerIntelPulse(now = performance.now()): boolean {
    return this.canUpdateRun() && !this.isIntelPulseActive(now) && this.intelPulseCharges > 0 && now >= this.intelPulseCooldownUntil;
  }

  private isIntelPulseActive(now = performance.now()): boolean {
    return this.intelPulseActiveUntil > now;
  }

  private resetIntelPulseForRun(): void {
    this.clearIntelPulseVisuals();
    this.intelPulseCharges = intelPulseMaxCharges;
    this.intelPulseStartedAt = 0;
    this.intelPulseActiveUntil = 0;
    this.intelPulseCooldownUntil = 0;
    this.intelPulseMobileSimplified = false;
    this.intelPulseLastAvailable = true;
  }

  private rebuildIntelPulseVisuals(includePatrols: boolean): void {
    this.intelPulseVisuals.rebuild(this.level, this.collectedObjectiveIds, includePatrols);
    if (!this.scene.children.includes(this.intelPulseVisuals.group)) {
      this.scene.add(this.intelPulseVisuals.group);
    }
  }

  private clearIntelPulseVisuals(): void {
    this.intelPulseVisuals.clear();
  }

  private updateIntelPulse(now: number): void {
    if (this.intelPulseActiveUntil > 0 && now >= this.intelPulseActiveUntil) {
      this.intelPulseStartedAt = 0;
      this.intelPulseActiveUntil = 0;
      this.clearIntelPulseVisuals();
      this.renderUi();
    } else if (this.isIntelPulseActive(now)) {
      const shimmer = 0.78 + Math.sin(now * 0.007) * 0.16;
      this.intelPulseVisuals.applyShimmer(shimmer);
    }

    const available = this.canTriggerIntelPulse(now);
    if (available !== this.intelPulseLastAvailable) {
      this.intelPulseLastAvailable = available;
      this.renderUi();
    }
  }

  private pickupWarmupSettings(): GameSettings {
    return {
      ...this.settings,
      musicEnabled: true,
      masterVolume: silentPickupWarmupVolume,
    };
  }

  private createLightFixture(light: LightSpec): THREE.Group {
    const group = new THREE.Group();
    group.position.set(light.position.x, light.height, light.position.z);
    group.name = `light-fixture:${light.id}`;

    const metal = new THREE.MeshStandardMaterial({
      color: '#6b7280',
      emissive: '#101923',
      emissiveIntensity: 0.2,
      roughness: 0.48,
      metalness: 0.45,
    });
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: '#f8fbff',
      emissive: '#cfe7ff',
      emissiveIntensity: 1.4,
      roughness: 0.22,
    });
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: '#dbeafe',
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), metal);
    stem.position.y = -0.22;
    stem.name = `light-stem:${light.id}`;

    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.22, 24), metal);
    shade.position.y = -0.5;
    shade.name = `light-shade:${light.id}`;

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), bulbMaterial);
    bulb.position.y = -0.66;
    bulb.name = `light-bulb:${light.id}`;

    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.1, 24, 1, true), beamMaterial);
    beam.position.y = -1.68;
    beam.name = `light-beam:${light.id}`;

    group.add(stem, shade, bulb, beam);
    return group;
  }

  private applyRendererQuality(): void {
    const profile = qualityProfile(this.rendererQuality());
    this.renderer.setPixelRatio(profile.pixelRatio);
    this.renderer.shadowMap.enabled = profile.shadows;
    this.allocateQualityMemory(profile.memoryReserveMb);
    for (const light of this.scene.children) {
      if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        light.castShadow = profile.shadows;
        light.shadow.mapSize.setScalar(profile.shadowMapSize);
      }
    }
  }

  private allocateQualityMemory(targetMb: number): void {
    if (targetMb === this.reservedMemoryMb) return;

    this.qualityMemoryReserve = targetMb > 0 ? new Float32Array((targetMb * 1024 * 1024) / 4) : null;
    this.reservedMemoryMb = targetMb;
    if (!this.qualityMemoryReserve) return;

    for (let index = 0; index < this.qualityMemoryReserve.length; index += 1024) {
      this.qualityMemoryReserve[index] = (index % 2048) / 2048;
    }
  }

  private createEnemy(spec: EnemySpec): EnemyRuntime {
    const character = this.characterAssets.createEnemy(spec.id, this.enemyAssetQuality());
    const mesh = character.object;

    const cone = new THREE.Mesh(
      createVisionConeGeometry(spec.visionRange, spec.visionAngleDegrees),
      new THREE.MeshBasicMaterial({
        color: '#ffcf5a',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    cone.position.y = 0.035;
    cone.name = `vision:${spec.id}`;

    const light = new THREE.SpotLight('#ffcf5a', 42, spec.visionRange, (spec.visionAngleDegrees * Math.PI) / 360, 0.55, 1.65);
    light.castShadow = this.rendererQuality() !== 'memory';
    light.shadow.mapSize.setScalar(qualityProfile(this.rendererQuality()).shadowMapSize);
    light.name = `vision-light:${spec.id}`;
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 8),
      new THREE.MeshBasicMaterial({ color: '#ffe08a' }),
    );
    lens.name = `vision-lens:${spec.id}`;
    const contactShadow = createContactShadow(0.82, 0.62, 0.25);

    return {
      spec,
      mesh,
      animator: character.animator,
      cone,
      light,
      lens,
      contactShadow,
      position: { ...spec.start },
      facing: normalize(subtract(spec.patrol[1] ?? spec.start, spec.start)),
      patrolIndex: 1,
      pauseRemaining: 0,
    };
  }

  private createObjective(spec: ObjectiveDefinition): ObjectiveRuntime {
    const mesh = this.objectiveAssets.create(spec, this.objectiveAssetQuality());
    const glow = createObjectiveGlow(spec.type, spec.position);
    glow.name = `objective-glow:${spec.id}`;

    return { spec, mesh, glow };
  }

  private rebuildObjectiveMeshes(): void {
    const specs = this.level.objectives ?? [];
    const disposal = createResourceDisposalState();
    this.objectives.forEach((objective) => {
      this.scene.remove(objective.mesh, objective.glow);
      disposeTransientObjectResources(objective.mesh, disposal);
      disposeTransientObjectResources(objective.glow, disposal);
    });
    this.objectives = specs.map((objective) => this.createObjective(objective));
    this.objectives.forEach((objective) => {
      this.scene.add(objective.mesh, objective.glow);
    });
    this.updateObjectiveMeshes();
  }

  private rebuildCharacterMeshes(): void {
    this.refreshPlayerVisual();
    this.playerMesh.position.set(this.playerPosition.x, 0.48, this.playerPosition.z);

    const disposal = createResourceDisposalState();
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
      enemy.animator?.dispose();
      disposeTransientObjectResources(enemy.mesh, disposal);
      const character = this.characterAssets.createEnemy(enemy.spec.id, this.enemyAssetQuality());
      enemy.mesh = character.object;
      enemy.animator = character.animator;
      this.scene.add(enemy.mesh);
      this.placeEnemy(enemy);
    }
  }

  private refreshPlayerVisual(): void {
    this.playerAnimator?.dispose();
    disposeTransientObjectResources(this.playerMesh);
    this.playerMesh.clear();
    const character = this.characterAssets.createHero(this.heroAssetQuality(), this.selectedHeroId);
    this.playerVisual = character.object;
    this.playerAnimator = character.animator;
    this.playerMesh.add(this.playerVisual);
  }

  private updatePlayer(delta: number): void {
    if (!this.canUpdateRun()) return;

    const movement = this.input.movement();
    this.facePlayerTowardMovement(movement, delta);
    const next = add(this.playerPosition, scale(movement, delta * 2.4));
    const clamped = clampToRoom(next, this.level.floorSize, playerRadius);
    const enemyHit = collidesWithEnemies(clamped, this.enemyBodies(), playerRadius);
    if (enemyHit) {
      this.currentDetection = { spotted: true, enemyId: enemyHit.id, rayBlocked: false, distance: 0 };
      this.setPhase('caught');
      console.warn(`[collision] player collided with ${enemyHit.id}`);
      return;
    }

    if (!collidesWithObstacles(clamped, this.level.obstacles, playerRadius)) {
      this.playerPosition = clamped;
      this.playerMesh.position.set(clamped.x, 0.48, clamped.z);
      this.playerContactShadow.position.set(clamped.x, 0.016, clamped.z);
    }

    this.collectObjectives();

    if (distance(this.playerPosition, this.level.goal) <= this.level.goalRadius + playerRadius && this.objectiveProgress().exitUnlocked) {
      this.completeLevel();
    }
  }

  private updateEnemies(delta: number): void {
    if (!this.canUpdateRun()) return;

    for (const enemy of this.enemies) {
      if (enemy.pauseRemaining > 0) {
        enemy.pauseRemaining -= delta;
        this.placeEnemy(enemy);
        continue;
      }

      const target = enemy.spec.patrol[enemy.patrolIndex] ?? enemy.spec.start;
      const toTarget = subtract(target, enemy.position);
      const remaining = distance(enemy.position, target);
      if (remaining < 0.04) {
        enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.spec.patrol.length;
        enemy.pauseRemaining = enemy.spec.pauseSeconds;
      } else {
        enemy.facing = normalize(toTarget);
        const proposed = add(enemy.position, scale(enemy.facing, Math.min(remaining, enemy.spec.speed * delta)));
        if (collidesWithObstacles(proposed, this.level.obstacles, enemyRadius)) {
          enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.spec.patrol.length;
          enemy.pauseRemaining = enemy.spec.pauseSeconds;
        } else {
          enemy.position = proposed;
        }
      }
      this.placeEnemy(enemy);
    }
  }

  private updateDetection(delta: number): void {
    if (!this.canUpdateRun()) return;

    let nearest: DetectionState = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };

    for (const enemy of this.enemies) {
      const state = getDetectionState(this.level, enemy.spec, enemy.position, enemy.facing, this.playerPosition);
      const raycastBlocked = this.raycastBlocked(enemy.position, this.playerPosition);
      const corrected = state.spotted && raycastBlocked ? { ...state, spotted: false, enemyId: null, rayBlocked: true } : state;
      if (corrected.distance < nearest.distance || corrected.spotted) {
        nearest = corrected;
      }
      if (corrected.spotted) {
        break;
      }
    }

    this.currentDetection = nearest;
    const previousStatus = this.currentSuspicion.status;
    this.currentSuspicion = advanceSuspicion(this.currentSuspicion, nearest, delta, this.settings.detectionLeniency);
    this.recordAlertTransition(previousStatus, this.currentSuspicion.status);
    if (this.currentSuspicion.status === 'detected' && this.canUpdateRun()) {
      this.setPhase('caught');
      console.warn(`[detection] player detected by ${this.currentSuspicion.enemyId}`);
    }

    const collision = collidesWithEnemies(this.playerPosition, this.enemyBodies(), playerRadius);
    if (collision && this.canUpdateRun()) {
      this.currentDetection = { spotted: true, enemyId: collision.id, rayBlocked: false, distance: 0 };
      this.recordAlertTransition(this.currentSuspicion.status, 'detected');
      this.currentSuspicion = { value: 1, status: 'detected', enemyId: collision.id };
      this.setPhase('caught');
      console.warn(`[collision] player collided with ${collision.id}`);
    }
  }

  private collectObjectives(options: CollectObjectiveOptions = {}): void {
    const audioSettings = options.audioSettings ?? this.settings;
    const recordDebug = options.recordDebug ?? true;
    const startFrameProbe = options.startFrameProbe ?? recordDebug;
    const log = options.log ?? true;
    const logAudio = options.logAudio ?? log;
    const startedAt = performance.now();
    const collectStartedAt = performance.now();
    const next = collectNearbyObjectives(this.level, this.playerPosition, this.collectedObjectiveIds);
    const collectMs = performance.now() - collectStartedAt;
    if (next.size === this.collectedObjectiveIds.size) return;

    const collectedNow = [...next].filter((id) => !this.collectedObjectiveIds.has(id));
    this.collectedObjectiveIds = next;
    const meshStartedAt = performance.now();
    this.updateObjectiveMeshes();
    if (this.isIntelPulseActive()) {
      this.rebuildIntelPulseVisuals(!this.intelPulseMobileSimplified);
    }
    const meshMs = performance.now() - meshStartedAt;
    const objective = (this.level.objectives ?? []).find((candidate) => collectedNow.includes(candidate.id));
    const progress = this.objectiveProgress();
    if (this.shouldShowObjectiveNotice()) {
      this.objectiveNotice = progress.exitUnlocked
        ? `Collected ${objective?.label ?? 'objective'} - exit unlocked`
        : `Collected ${objective?.label ?? 'objective'}`;
      this.objectiveNoticeUntil = performance.now() + 2600;
    } else {
      this.objectiveNotice = '';
      this.objectiveNoticeUntil = 0;
    }
    const audioStartedAt = performance.now();
    const audioDebug = this.music.playPickup(audioSettings, { log: logAudio });
    const audioMs = performance.now() - audioStartedAt;
    const uiStartedAt = performance.now();
    this.renderUi();
    const uiMs = performance.now() - uiStartedAt;
    const totalMs = performance.now() - startedAt;
    if (recordDebug) {
      this.pickupDebug = createPickupDebugSample({
        id: objective?.id ?? collectedNow[0] ?? null,
        label: objective?.label ?? 'objective',
        collectedAtMs: startedAt,
        totalMs,
        collectMs,
        meshMs,
        audioMs,
        uiMs,
        audio: audioDebug,
      });
    }
    if (startFrameProbe) {
      this.pickupFrameProbe = beginPickupFrameProbe(startedAt);
    }
    if (log) {
      console.info(
        `[objective] collected=${[...this.collectedObjectiveIds].join(',')} pickupMs=${totalMs.toFixed(1)} audioMs=${audioMs.toFixed(1)} uiMs=${uiMs.toFixed(1)}`,
      );
    }
  }

  private updateObjectiveMeshes(): void {
    for (const objective of this.objectives) {
      const collected = this.collectedObjectiveIds.has(objective.spec.id);
      objective.mesh.visible = !collected;
      objective.glow.visible = !collected;
    }

    const unlocked = this.objectiveProgress().exitUnlocked;
    this.goalBeaconMesh.visible = unlocked;
    if (this.goalMesh.material instanceof THREE.MeshStandardMaterial) {
      this.goalMesh.material.color.set(unlocked ? '#7dff9b' : '#374151');
      this.goalMesh.material.emissive.set(unlocked ? '#1a6f34' : '#0d131b');
      this.goalMesh.material.emissiveIntensity = unlocked ? 0.85 : 0.12;
    }
  }

  private updateDebugRays(): void {
    disposeTransientObjectResources(this.debugRays);
    this.debugRays.clear();
    if (!this.settings.debugEnabled) return;

    const materialClear = new THREE.LineBasicMaterial({ color: '#7dfcc6', transparent: true, opacity: 0.7 });
    const materialBlocked = new THREE.LineBasicMaterial({ color: '#ff5964', transparent: true, opacity: 0.85 });

    for (const enemy of this.enemies) {
      const blocked = isSightBlocked(this.level, enemy.position, this.playerPosition);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(enemy.position.x, 0.12, enemy.position.z),
        new THREE.Vector3(this.playerPosition.x, 0.12, this.playerPosition.z),
      ]);
      this.debugRays.add(new THREE.Line(geometry, blocked ? materialBlocked : materialClear));
    }
  }

  private raycastBlocked(from: Vec2, to: Vec2): boolean {
    const origin = new THREE.Vector3(from.x, 0.62, from.z);
    const target = new THREE.Vector3(to.x, 0.62, to.z);
    const direction = target.clone().sub(origin);
    const range = direction.length();
    const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, range);
    const hits = raycaster.intersectObjects(this.blockers, false);
    return hits.length > 0;
  }

  private isTransitioning(): boolean {
    return isLoadingPhase(this.phase);
  }

  private hasActiveLevelScene(): boolean {
    const effectivePhase = this.phase === 'settings' ? this.settingsReturnPhase : this.phase;
    return effectivePhase === 'playing' || effectivePhase === 'caught' || effectivePhase === 'complete';
  }

  private hasTitlePreviewScene(): boolean {
    const effectivePhase = this.phase === 'settings' ? this.settingsReturnPhase : this.phase;
    return effectivePhase === 'menu' || effectivePhase === 'goals' || effectivePhase === 'character-select';
  }

  private runtimeQuality(): RenderQuality {
    return this.rendererQuality();
  }

  private rendererQuality(): RenderQuality {
    return this.memorySafeAssets ? 'memory' : this.settings.quality;
  }

  private heroAssetQuality(): RenderQuality {
    return this.settings.quality === 'cinematic' ? 'cinematic' : this.settings.quality;
  }

  private enemyAssetQuality(): RenderQuality {
    return this.memorySafeAssets ? 'memory' : this.settings.quality;
  }

  private objectiveAssetQuality(): RenderQuality {
    return this.memorySafeAssets ? 'memory' : this.settings.quality;
  }

  private usesMenuMusic(): boolean {
    return isMenuMusicPhase(this.phase, this.settingsReturnPhase);
  }

  private usesLevelMusic(): boolean {
    return isLevelMusicPhase(this.phase, this.settingsReturnPhase);
  }

  private async syncMusicForCurrentPhase(): Promise<void> {
    if (this.usesMenuMusic()) {
      await this.music.playMenu(this.settings);
      return;
    }

    if (this.usesLevelMusic()) {
      await this.music.sync(this.settings, soundtrackIdForLevel(this.levelIndex));
    }
  }

  private canUpdateRun(): boolean {
    return isPlayingPhase(this.phase);
  }

  private placeEnemy(enemy: EnemyRuntime): void {
    enemy.mesh.position.set(enemy.position.x, enemyHoverBaseY, enemy.position.z);
    enemy.mesh.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
    enemy.cone.position.set(enemy.position.x, 0.035, enemy.position.z);
    enemy.cone.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
    enemy.contactShadow.position.set(enemy.position.x, 0.018, enemy.position.z);
    this.placeEnemySpotlight(enemy, enemy.mesh.position.y);
    this.scene.add(enemy.light.target);
  }

  private placeEnemySpotlight(enemy: EnemyRuntime, meshY: number): void {
    const frontOffset = 0.32;
    enemy.light.position.set(enemy.position.x + enemy.facing.x * frontOffset, meshY + 1.14, enemy.position.z + enemy.facing.z * frontOffset);
    enemy.light.target.position.set(enemy.position.x + enemy.facing.x * 1.35, meshY + 0.24, enemy.position.z + enemy.facing.z * 1.35);
    enemy.lens.position.copy(enemy.light.position);
  }

  private clearLevelObjects(): void {
    this.playerAnimator?.dispose();
    this.enemies.forEach((enemy) => enemy.animator?.dispose());
    const persistent = new Set<THREE.Object3D>([this.debugRays, this.intelPulseVisuals.group]);
    const disposal = createResourceDisposalState();
    this.resetIntelPulseForRun();
    for (const child of [...this.scene.children]) {
      if (persistent.has(child) || child instanceof THREE.AmbientLight) continue;
      this.scene.remove(child);
      if (child === this.titlePreview) {
        this.clearTitlePreview(disposal);
      } else if (child === this.playerContactShadow) {
        continue;
      } else {
        disposeTransientObjectResources(child, disposal);
      }
    }
    this.playerMesh.clear();
    this.playerVisual = null;
    this.playerAnimator = null;
    this.goalMesh = new THREE.Mesh();
    this.goalBeaconMesh = new THREE.Mesh();
    this.blockers = [];
    this.enemies = [];
    this.objectives = [];
    this.flushRendererObjectCaches();
  }

  private clearTitlePreview(disposal: ResourceDisposalState = createResourceDisposalState()): void {
    this.titleHeroAnimator?.dispose();
    disposeTransientObjectResources(this.titlePreview, disposal);
    this.titlePreview.clear();
    this.titleHeroVisual = null;
    this.titleHeroAnimator = null;
    this.titlePreviewHeroId = null;
    this.titleHeroPreviewCompact = null;
    this.flushRendererObjectCaches();
  }

  private flushRendererObjectCaches(): void {
    this.renderer.renderLists.dispose();
  }

  private updateCharacterAnimations(now: number, delta: number): void {
    if (this.phase === 'menu' || this.phase === 'character-select') {
      this.titleHeroAnimator?.setMotionState('idle');
      this.titleHeroAnimator?.update(delta);
      if (this.titleHeroVisual) {
        const time = now / 1000;
        this.layoutTitleHeroPreview();
        this.titleHeroVisual.position.y = this.titleHeroPreviewY() + Math.sin(time * 2.2) * 0.015;
        this.updateTitlePreviewAtmosphere(time);
      }
      return;
    }

    if (this.heroAssetQuality() !== 'cinematic') return;

    const time = now / 1000;
    this.playerAnimator?.update(delta);
    if (this.playerVisual) {
      const movement = this.canUpdateRun() ? this.input.movement() : { x: 0, z: 0 };
      const moving = Math.hypot(movement.x, movement.z) > 0.01;
      this.playerAnimator?.setMotionState(moving ? 'run' : 'idle');
      this.playerVisual.position.y = moving ? Math.sin(time * 12) * 0.035 : Math.sin(time * 3) * 0.012;
      this.playerVisual.rotation.z = moving ? Math.sin(time * 12) * 0.045 : 0;
      this.playerVisual.rotation.x = moving ? Math.cos(time * 9) * 0.028 : 0;
    }

    this.enemies.forEach((enemy, index) => {
      enemy.animator?.update(delta);
      const hoverY = enemyHoverBaseY + Math.sin(time * enemyHoverSpeed + index * 0.9) * enemyHoverAmplitude;
      enemy.mesh.position.y = hoverY;
      enemy.mesh.rotation.z = Math.sin(time * enemyHoverSpeed * 0.7 + index) * 0.018;
      this.placeEnemySpotlight(enemy, hoverY);
    });
  }

  private readonly tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateDetection(delta);
    this.updateDebugRays();
    this.updateCharacterAnimations(now, delta);
    this.updateIntelPulse(now);
    if (this.objectiveNotice && now > this.objectiveNoticeUntil) {
      this.objectiveNotice = '';
      this.renderUi();
    }
    if (this.achievementNotice && now > this.achievementNoticeUntil) {
      this.achievementNotice = '';
      this.achievementNoticeUntil = 0;
      this.showNextAchievementNotice(now);
      this.renderUi();
    }
    if (this.canUpdateRun()) {
      const hudSecond = Math.floor(this.currentRunElapsedMs() / 1000);
      if (hudSecond !== this.lastHudSecond) {
        this.lastHudSecond = hudSecond;
        this.ui.updateRunHud(this.currentRunElapsedMs(), this.runAlertCount);
        this.ui.renderIntelPulse(this.phase, this.intelPulseUiState(now));
      }
    }
    this.goalMesh.rotation.y += delta * 0.9;
    this.updateTutorialCamera(now);
    this.updateHeroDebugCamera();
    this.updateEnemyDebugCamera();
    this.renderer.render(this.scene, this.camera);
    this.renderedFrameCount += 1;

    const sample = this.debugPanel.sample(now, this.renderer.info.render.calls, this.renderer.info.render.triangles, this.reservedMemoryMb);
    const pickupProbeResult = updatePickupFrameProbe(this.pickupDebug, this.pickupFrameProbe, sample.frameMs, now);
    this.pickupDebug = pickupProbeResult.debug;
    this.pickupFrameProbe = pickupProbeResult.probe;
    this.latestDebugSample = sample;
    this.reportMemoryPressure(sample.usedMemoryMb);
    this.debugPanel.render(
      this.settings,
      this.level,
      this.playerPosition,
      this.currentDetection,
      this.currentSuspicion,
      this.objectiveProgress(),
      sample,
      this.pickupDebug,
      this.music.currentTrack(),
    );
    this.renderer.info.reset();
  };

  private readonly resize = (): void => {
    const bounds = this.ui.root.getBoundingClientRect();
    const width = Math.max(320, bounds.width);
    const height = Math.max(320, bounds.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    if (this.phase === 'tutorial') {
      this.updateTutorialCamera(performance.now(), true);
    } else {
      this.fitCameraToLevel();
    }
    this.camera.updateProjectionMatrix();
  };

  private readonly handleHotkeys = (event: KeyboardEvent): void => {
    if (this.isTransitioning()) return;

    if (this.phase === 'tutorial') {
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        this.advanceTutorial();
      } else if (event.code === 'Escape') {
        event.preventDefault();
        this.skipTutorial();
      }
      return;
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.canUpdateRun()) {
        this.openMenu();
      } else if (this.phase === 'settings') {
        void this.resumeFromSettings();
      } else if (this.phase === 'level-select') {
        this.setPhase(this.levelSelectReturnPhase);
      } else if (this.phase === 'goals') {
        this.openMenu();
      }
    }
    if (event.code === 'F1') {
      event.preventDefault();
      void this.applySettings({ ...this.settings, debugEnabled: !this.settings.debugEnabled });
    }
    if (event.code === 'KeyQ') {
      event.preventDefault();
      this.triggerIntelPulse();
    }
  };

  private installDebugHooks(): void {
    if (!import.meta.env.DEV) return;

    window.__shadowCircuitDebug = {
      forceCaught: () => this.setPhase('caught'),
      phase: () => this.phase,
      selectLevel: (levelIndex: number) => this.selectLevel(levelIndex),
      levelCount: () => levels.length,
      loadingProgress: () => this.loadingProgress,
      pickupDebug: () => this.pickupDebug,
      performance: () => this.latestDebugSample,
      renderFrameCount: () => this.renderedFrameCount,
      shaderWarmupPasses: () => this.shaderWarmupPasses,
      levelId: () => this.level.id,
      goalVisible: () => this.isGoalVisibleInCamera(),
      playerVisible: () => this.isPlayerVisibleInCamera(),
      objectiveVisible: (objectiveId: string) => this.isObjectiveVisibleInCamera(objectiveId),
      forceEnemyCollision: () => this.forceEnemyCollision(),
      suspicion: () => this.currentSuspicion,
      objectives: () => this.objectiveProgress(),
      goalLit: () => this.goalBeaconMesh.visible,
      movePlayerTo: (point: Vec2) => this.movePlayerTo(point),
      playerPosition: () => this.playerPosition,
      heroAnimation: () => this.heroAnimationDebugState(),
      setHeroDebugView: (enabled: boolean) => this.setHeroDebugView(enabled),
      titleHero: () => this.titleHeroDebugState(),
      enemySentry: () => this.enemySentryDebugState(),
      setEnemyDebugView: (enabled: boolean) => this.setEnemyDebugView(enabled),
      activeTrackId: () => this.music.currentTrack(),
      musicPlayback: () => this.music.playbackState(),
      musicEnabled: () => this.settings.musicEnabled,
      memorySafeAssets: () => this.memorySafeAssets,
      runtimeQuality: () => this.runtimeQuality(),
      heroAssetQuality: () => this.heroAssetQuality(),
      enemyAssetQuality: () => this.enemyAssetQuality(),
      rendererMemory: () => ({ ...this.renderer.info.memory }),
      sceneObjectCounts: () => ({
        objectives: this.objectives.length,
        enemies: this.enemies.length,
        blockers: this.blockers.length,
        goalInScene: this.goalMesh.parent !== null,
        titlePreviewVisible: this.titlePreview.visible,
      }),
      selectedHero: () => this.selectedHeroId,
      heroRoster: () => heroOptions.map((hero) => hero.id),
      loadedHeroAssets: () => this.characterAssets.loadedHeroIds(),
      achievements: () => this.achievementProgress,
      mastery: () => this.levelMastery,
      encorePick: () => this.encorePick,
      nextRunTarget: () => this.nextRunTarget,
      refreshReplayProgress: () => this.refreshReplayProgress(),
      intelPulse: () => this.intelPulseUiState(),
      intelPulseVisualStats: () => this.intelPulseVisuals.stats(),
      triggerIntelPulse: () => this.triggerIntelPulse(),
      tutorialState: () => this.tutorialDebugState(),
      setTutorialShot: (shotId: TutorialShotId) => this.setTutorialShotForDebug(shotId),
      advanceTutorial: () => this.advanceTutorial(),
      skipTutorial: () => this.skipTutorial(),
      setTutorialSeen: (seen: boolean) => this.markFirstRunTutorialSeen(seen),
    };
  }

  private tutorialDebugState(): TutorialDebugState {
    return {
      ...this.tutorialUiState,
      phase: this.phase,
      targetVisible: this.tutorialFocusObject ? this.isObjectVisibleInCamera(this.tutorialFocusObject) : false,
      targetScreen: this.tutorialFocusObject ? this.projectObjectToScreen(this.tutorialFocusObject) : null,
      selectedHero: this.selectedHeroId,
      desktopEligible: this.isFirstRunTutorialViewportEligible(),
      seen: this.hasSeenFirstRunTutorial(),
    };
  }

  private setTutorialShotForDebug(shotId: TutorialShotId): boolean {
    if (this.phase !== 'tutorial') return false;

    const shots = this.tutorialShots.length > 0 ? this.tutorialShots : this.buildFirstRunTutorialShots();
    const index = shots.findIndex((shot) => shot.id === shotId);
    if (index < 0) return false;

    this.tutorialShots = shots;
    this.startTutorialShot(shots[index], index, shots.length, true);
    if (this.tutorialAdvanceResolver) {
      this.scheduleTutorialAdvance(this.tutorialAdvanceResolver, 60000);
    }
    return true;
  }

  private forceEnemyCollision(): void {
    const enemy = this.enemies[0];
    if (!enemy) return;

    this.playerPosition = { ...enemy.position };
    this.playerMesh.position.set(this.playerPosition.x, 0.48, this.playerPosition.z);
    this.playerContactShadow.position.set(this.playerPosition.x, 0.016, this.playerPosition.z);
    this.currentDetection = { spotted: true, enemyId: enemy.spec.id, rayBlocked: false, distance: 0 };
    this.setPhase('caught');
  }

  private movePlayerTo(point: Vec2): void {
    const clamped = clampToRoom(point, this.level.floorSize, playerRadius);
    if (collidesWithObstacles(clamped, this.level.obstacles, playerRadius)) return;
    this.playerPosition = clamped;
    this.playerMesh.position.set(clamped.x, 0.48, clamped.z);
    this.playerContactShadow.position.set(clamped.x, 0.016, clamped.z);
    this.collectObjectives();
  }

  private facePlayerTowardMovement(movement: Vec2, delta: number): void {
    if (Math.hypot(movement.x, movement.z) < 0.01) return;

    const targetYaw = Math.atan2(movement.x, movement.z);
    this.playerMesh.rotation.y = dampAngle(this.playerMesh.rotation.y, targetYaw, 1 - Math.exp(-18 * delta));
  }

  private setHeroDebugView(enabled: boolean): void {
    this.heroDebugView = enabled;
    if (enabled) this.enemyDebugView = false;
    if (enabled) {
      this.updateHeroDebugCamera();
    } else {
      this.fitCameraToLevel();
    }
  }

  private updateHeroDebugCamera(): void {
    if (!this.heroDebugView) return;

    const target = new THREE.Vector3(this.playerPosition.x, 0.72, this.playerPosition.z);
    this.camera.position.set(target.x, target.y + 2.25, target.z + 3.1);
    this.camera.lookAt(target);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 4;
      this.scene.fog.far = 11;
    }
  }

  private heroAnimationDebugState(): { activeState: string | null; clipNames: readonly string[]; yaw: number; debugCamera: boolean } {
    const snapshot = this.playerAnimator?.snapshot();
    return {
      activeState: snapshot?.activeState ?? null,
      clipNames: snapshot?.clipNames ?? [],
      yaw: this.playerMesh.rotation.y,
      debugCamera: this.heroDebugView,
    };
  }

  private titleHeroDebugState(): {
    visible: boolean;
    inCamera: boolean;
    cinematic: boolean;
    activeState: string | null;
    clipNames: readonly string[];
    x: number | null;
    y: number | null;
    screen: { x: number; y: number } | null;
  } {
    const snapshot = this.titleHeroAnimator?.snapshot();
    const visible = (this.phase === 'menu' || this.phase === 'character-select') && this.scene.children.includes(this.titlePreview) && Boolean(this.titleHeroVisual);
    return {
      visible,
      inCamera: visible && this.titleHeroVisual ? this.isObjectVisibleInCamera(this.titleHeroVisual) : false,
      cinematic: this.titleHeroAnimator !== null,
      activeState: snapshot?.activeState ?? null,
      clipNames: snapshot?.clipNames ?? [],
      x: this.titleHeroVisual?.position.x ?? null,
      y: this.titleHeroVisual?.position.y ?? null,
      screen: this.titleHeroVisual ? this.projectObjectToScreen(this.titleHeroVisual) : null,
    };
  }

  private setEnemyDebugView(enabled: boolean): void {
    this.enemyDebugView = enabled;
    if (enabled) this.heroDebugView = false;
    if (enabled) {
      this.updateEnemyDebugCamera();
    } else {
      this.fitCameraToLevel();
    }
  }

  private updateEnemyDebugCamera(): void {
    if (!this.enemyDebugView) return;

    const enemy = this.enemies[0];
    if (!enemy) return;

    const target = new THREE.Vector3(enemy.position.x, enemy.mesh.position.y + 0.45, enemy.position.z);
    const side = new THREE.Vector3(enemy.facing.z, 0, -enemy.facing.x);
    this.camera.position.set(
      target.x + enemy.facing.x * 1.85 + side.x * 2.85,
      target.y + 1.75,
      target.z + enemy.facing.z * 1.85 + side.z * 2.85,
    );
    this.camera.lookAt(target.x + enemy.facing.x * 0.18, target.y, target.z + enemy.facing.z * 0.18);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 4;
      this.scene.fog.far = 12;
    }
  }

  private enemySentryDebugState(): {
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
  } {
    const enemy = this.enemies[0];
    if (!enemy) {
      return {
        id: null,
        cinematic: false,
        meshName: null,
        position: null,
        meshY: null,
        yaw: null,
        facing: null,
        lightDirection: null,
        lightFrontOffset: null,
        lightHeightOffset: null,
        debugCamera: this.enemyDebugView,
      };
    }

    const lightDirection = normalize({
      x: enemy.light.target.position.x - enemy.light.position.x,
      z: enemy.light.target.position.z - enemy.light.position.z,
    });
    const lightFrontOffset =
      (enemy.light.position.x - enemy.position.x) * enemy.facing.x + (enemy.light.position.z - enemy.position.z) * enemy.facing.z;
    return {
      id: enemy.spec.id,
      cinematic: enemy.mesh.name.endsWith(':cinematic'),
      meshName: enemy.mesh.name,
      position: { ...enemy.position },
      meshY: enemy.mesh.position.y,
      yaw: enemy.mesh.rotation.y,
      facing: { ...enemy.facing },
      lightDirection,
      lightFrontOffset,
      lightHeightOffset: enemy.light.position.y - enemy.mesh.position.y,
      debugCamera: this.enemyDebugView,
    };
  }

  private isGoalVisibleInCamera(): boolean {
    return this.isObjectVisibleInCamera(this.goalMesh);
  }

  private isPlayerVisibleInCamera(): boolean {
    return this.isObjectVisibleInCamera(this.playerMesh);
  }

  private isObjectiveVisibleInCamera(objectiveId: string): boolean {
    const objective = this.objectives.find((candidate) => candidate.spec.id === objectiveId);
    return objective ? this.isObjectVisibleInCamera(objective.mesh) : false;
  }

  private fitCameraToLevel(): void {
    if (this.phase === 'menu' || this.phase === 'character-select') {
      this.fitCameraToTitle();
      return;
    }
    if (this.phase === 'tutorial' && this.tutorialShot) {
      this.updateTutorialCamera(performance.now(), true);
      return;
    }
    if (this.heroDebugView) {
      this.updateHeroDebugCamera();
      return;
    }
    if (this.enemyDebugView) {
      this.updateEnemyDebugCamera();
      return;
    }

    const scale = this.levelCameraScale();
    this.camera.position.copy(this.standardLevelCameraPosition(scale));
    this.camera.lookAt(0, 0, 0);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 8 * scale;
      this.scene.fog.far = 22 * scale;
    }
  }

  private standardLevelCameraPosition(scale = this.levelCameraScale()): THREE.Vector3 {
    return new THREE.Vector3(0, 10.2 * scale, 10.4 * scale);
  }

  private levelCameraScale(): number {
    const floorScale = Math.max(1, this.level.floorSize.x / 16.5, this.level.floorSize.z / 11.8, this.camera.aspect < 1 ? 1.2 : 1);
    return this.isCompactLandscapeViewport() ? floorScale * compactLandscapeLevelCameraScale : floorScale;
  }

  private fitCameraToTitle(): void {
    this.syncTitleHeroPreviewPresentation();
    this.layoutTitleHeroPreview();
    const aspectOffset = this.camera.aspect < 1 ? 0.65 : 0;
    const compactCharacterSelect = this.useCompactTitleHeroPreview();
    this.camera.position.set(1.15 + aspectOffset, compactCharacterSelect ? 1.72 : 1.12, 3.15);
    this.camera.lookAt(1.35, compactCharacterSelect ? 1.18 : 0.68, 0);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 6;
      this.scene.fog.far = 18;
    }
  }

  private isObjectVisibleInCamera(object: THREE.Object3D): boolean {
    this.camera.updateMatrixWorld();
    object.updateMatrixWorld();
    const position = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z >= -1 && position.z <= 1;
  }

  private projectObjectToScreen(object: THREE.Object3D): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    object.updateMatrixWorld();
    const position = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return {
      x: ((position.x + 1) / 2) * this.ui.root.clientWidth,
      y: ((1 - position.y) / 2) * this.ui.root.clientHeight,
    };
  }

  private reportMemoryPressure(usedMemoryMb: number | null): void {
    if (usedMemoryMb === null || usedMemoryMb <= memoryCapMb) {
      this.memoryPressureWarned = false;
      return;
    }

    if (this.memoryPressureWarned) return;

    this.memoryPressureWarned = true;
    console.warn(
      `[performance] memory cap exceeded ${usedMemoryMb.toFixed(1)} MB > ${memoryCapMb} MB; keeping selected ${this.settings.quality} quality, renderer ${this.rendererQuality()}, hero ${this.heroAssetQuality()}, enemy ${this.enemyAssetQuality()}`,
    );
  }

  private renderUi(): void {
    const runElapsedMs =
      this.runStartedAt > 0 && this.phase !== 'menu'
        ? this.runSummary?.elapsedMs ?? this.currentRunElapsedMs()
        : null;
    this.ui.renderHud(
      this.level,
      this.levelIndex,
      this.phase,
      levels.length,
      this.currentSuspicion,
      this.objectiveProgress(),
      this.objectiveNotice,
      runElapsedMs,
      this.runAlertCount,
    );
    this.ui.renderIntelPulse(this.phase, this.intelPulseUiState(performance.now()));
    this.ui.renderOverlay(
      this.phase,
      this.level,
      levels,
      this.levelIndex,
      this.runSummary,
      this.loadingProgress,
      this.selectedHeroId,
      this.achievementProgress,
      this.levelMastery,
      this.encorePick,
      this.nextRunTarget,
      this.retryTarget,
      this.tutorialUiState,
    );
    this.ui.renderAchievementNotice(this.achievementNotice);
    this.ui.setTouchControlsVisible(this.canUpdateRun());
  }

  private enemyBodies(): { id: string; position: Vec2; radius: number }[] {
    return this.enemies.map((enemy) => ({ id: enemy.spec.id, position: enemy.position, radius: enemyRadius }));
  }

  private get level(): LevelDefinition {
    return levels[this.levelIndex];
  }

  private objectiveProgress(): ObjectiveProgress {
    return getObjectiveProgress(this.level, this.collectedObjectiveIds);
  }

  private intelPulseUiState(now = performance.now()): IntelPulseUiState {
    const active = this.isIntelPulseActive(now);
    const cooldownMs = Math.max(0, this.intelPulseCooldownUntil - now);
    const activeProgress = active ? clamp01((this.intelPulseActiveUntil - now) / intelPulseDurationMs) : 0;
    const cooldownProgress = cooldownMs > 0 ? 1 - clamp01(cooldownMs / intelPulseCooldownMs) : 1;
    const potentialPlan =
      this.intelPulseVisuals.plan ??
      createIntelPulsePlan(this.level, this.collectedObjectiveIds, { includePatrols: !this.isMobileInterface() });

    return {
      charges: this.intelPulseCharges,
      maxCharges: intelPulseMaxCharges,
      active,
      available: this.canTriggerIntelPulse(now),
      cooldownMs,
      cooldownProgress,
      activeProgress,
      mobileSimplified: this.intelPulseMobileSimplified || this.isMobileInterface(),
      objectiveTargets: potentialPlan.objectiveMarkers.length,
      exitTargets: 1,
      patrolRoutes: this.intelPulseMobileSimplified ? 0 : potentialPlan.patrolRoutes.length,
      waypointTargets: this.intelPulseMobileSimplified ? 0 : potentialPlan.waypointCount,
    };
  }

  private beginRun(): void {
    this.runStartedAt = performance.now();
    this.runAlertCount = 0;
    this.runSummary = null;
    this.retryTarget = null;
    this.lastHudSecond = -1;
  }

  private currentRunElapsedMs(): number {
    return this.runStartedAt > 0 ? performance.now() - this.runStartedAt : 0;
  }

  private refreshReplayProgress(): {
    achievements: readonly AchievementProgress[];
    mastery: readonly LevelMasteryProgress[];
    encorePick: EncorePick | null;
    nextRunTarget: NextRunTarget | null;
  } {
    this.achievementProgress = loadAchievementProgress(achievementLevelIds);
    this.levelMastery = loadLevelMasteryProgress(levels);
    this.encorePick = buildEncorePick(levels, this.levelMastery);
    this.nextRunTarget = buildNextRunTarget(levels, this.levelMastery, this.encorePick);

    return {
      achievements: this.achievementProgress,
      mastery: this.levelMastery,
      encorePick: this.encorePick,
      nextRunTarget: this.nextRunTarget,
    };
  }

  private completeLevel(): void {
    const previousBestTimeMs = loadBestTime(this.level.id);
    const summary = createRunSummary({
      elapsedMs: this.currentRunElapsedMs(),
      parSeconds: this.level.parSeconds,
      alerts: this.runAlertCount,
      previousBestTimeMs,
    });

    if (summary.isNewBest) {
      saveBestTime(this.level.id, summary.elapsedMs);
    }

    const achievements = recordLevelAchievementClear({
      levelId: this.level.id,
      grade: summary.grade,
      levelIds: achievementLevelIds,
    });
    this.achievementProgress = achievements.progress;
    this.queueAchievementNotices(achievements.unlocked);
    this.levelMastery = loadLevelMasteryProgress(levels);
    this.encorePick = buildEncorePick(levels, this.levelMastery);
    this.nextRunTarget = buildNextRunTarget(levels, this.levelMastery, this.encorePick);
    const currentMastery = this.levelMastery.find((mastery) => mastery.levelId === this.level.id);
    this.retryTarget = currentMastery ? retryTargetForCompletion(this.level, summary, currentMastery) : null;

    this.runSummary = summary;
    this.objectiveNotice = '';
    this.objectiveNoticeUntil = 0;
    this.clearIntelPulseVisuals();
    this.intelPulseStartedAt = 0;
    this.intelPulseActiveUntil = 0;
    this.setPhase('complete');
  }

  private queueAchievementNotices(unlocked: readonly AchievementProgress[]): void {
    if (unlocked.length === 0) return;

    this.achievementNoticeQueue.push(...unlocked.map((achievement) => achievement.title));
    if (!this.achievementNotice) {
      this.showNextAchievementNotice(performance.now());
    }
  }

  private showNextAchievementNotice(now: number): void {
    const nextNotice = this.achievementNoticeQueue.shift();
    if (!nextNotice) return;

    this.achievementNotice = nextNotice;
    this.achievementNoticeUntil = now + 8000;
  }

  private recordAlertTransition(previous: SuspicionState['status'], next: SuspicionState['status']): void {
    if (this.canUpdateRun() && previous === 'hidden' && next !== 'hidden') {
      this.runAlertCount += 1;
      this.ui.updateRunHud(this.currentRunElapsedMs(), this.runAlertCount);
    }
  }
}

function isMenuMusicPhase(phase: GamePhase, settingsReturnPhase: GamePhase): boolean {
  return (
    phase === 'menu' ||
    phase === 'goals' ||
    phase === 'character-select' ||
    (phase === 'settings' && (settingsReturnPhase === 'menu' || settingsReturnPhase === 'goals' || settingsReturnPhase === 'character-select'))
  );
}

function isLevelMusicPhase(phase: GamePhase, settingsReturnPhase: GamePhase): boolean {
  return (
    phase === 'playing' ||
    phase === 'caught' ||
    phase === 'complete' ||
    (phase === 'level-select' && settingsReturnPhase !== 'menu' && settingsReturnPhase !== 'character-select') ||
    (phase === 'settings' && settingsReturnPhase !== 'menu' && settingsReturnPhase !== 'goals' && settingsReturnPhase !== 'character-select')
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function createContactShadow(width: number, depth: number, opacity: number): THREE.Mesh {
  const material = createContactShadowMaterial();
  material.opacity = opacity;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width, depth, 1);
  shadow.name = 'contact-shadow';
  return shadow;
}

function createTitleOperationStage(centerX: number, compactPreview: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'title-operation-stage';
  const width = compactPreview ? 3.8 : 5.6;
  const depth = compactPreview ? 2.25 : 3.2;

  group.add(createTitleFloorGrid(centerX, width, depth, compactPreview ? 0.42 : 0.52));
  group.add(createTitleRouteLine(centerX));
  group.add(createTitleSecurityBars(centerX));
  group.add(createTitleObjectiveNode(centerX - 1.35, 0.72, '#ffd45a', 'title-keycard-node', false));
  group.add(createTitleObjectiveNode(centerX + 0.88, -0.52, '#5ad7ff', 'title-objective-pulse', true));
  group.add(createTitleSentrySweep(centerX + 1.72, -0.9));

  return group;
}

function createTitleFloorGrid(centerX: number, width: number, depth: number, step: number): THREE.LineSegments {
  const positions: number[] = [];
  const startX = centerX - width / 2;
  const endX = centerX + width / 2;
  const startZ = -depth / 2;
  const endZ = depth / 2;

  for (let x = startX; x <= endX + 0.001; x += step) {
    positions.push(x, 0.018, startZ, x, 0.018, endZ);
  }
  for (let z = startZ; z <= endZ + 0.001; z += step) {
    positions.push(startX, 0.018, z, endX, 0.018, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = transientLineMaterial('#5ad7ff', 0.16);
  const grid = new THREE.LineSegments(geometry, material);
  grid.name = 'title-floor-grid';
  grid.renderOrder = -8;
  return grid;
}

function createTitleRouteLine(centerX: number): THREE.Line {
  const points = [
    new THREE.Vector3(centerX - 2.15, 0.042, 0.94),
    new THREE.Vector3(centerX - 1.22, 0.042, -0.18),
    new THREE.Vector3(centerX - 0.22, 0.042, 0.22),
    new THREE.Vector3(centerX + 1.44, 0.042, -0.78),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const route = new THREE.Line(geometry, transientLineMaterial('#ffd45a', 0.6));
  route.name = 'title-route-line';
  route.renderOrder = -5;
  return route;
}

function createTitleSecurityBars(centerX: number): THREE.LineSegments {
  const positions: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    const x = centerX - 1.7 + index * 0.62;
    positions.push(x, 0.08, -1.28, x, 1.14, -1.28);
  }
  positions.push(centerX - 1.95, 0.08, -1.28, centerX + 1.95, 0.08, -1.28);
  positions.push(centerX - 1.95, 1.14, -1.28, centerX + 1.95, 1.14, -1.28);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const bars = new THREE.LineSegments(geometry, transientLineMaterial('#7dfcc6', 0.18));
  bars.name = 'title-security-bars';
  bars.renderOrder = -7;
  return bars;
}

function createTitleObjectiveNode(x: number, z: number, color: THREE.ColorRepresentation, name: string, pulse: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const coreMaterial = transientBasicMaterial({ color, transparent: true, opacity: 0.82 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16), coreMaterial);
  core.position.set(x, 0.058, z);
  core.name = `${name}:core`;

  const ringMaterial = transientBasicMaterial({ color, transparent: true, opacity: pulse ? 0.32 : 0.22, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.19, 24), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.064, z);
  ring.name = `${name}:ring`;

  group.add(core, ring);
  return group;
}

function createTitleSentrySweep(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'title-patrol-sweep';
  group.position.set(x, 0.052, z);
  group.rotation.y = -0.18;

  const bodyMaterial = transientBasicMaterial({ color: '#ff5964', transparent: true, opacity: 0.78 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 5), bodyMaterial);
  body.position.y = 0.2;
  body.rotation.x = Math.PI;
  body.name = 'title-sentry-marker';

  const coneGeometry = new THREE.BufferGeometry();
  coneGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      0, 0.012, 0,
      -0.66, 0.012, -1.18,
      0.66, 0.012, -1.18,
    ], 3),
  );
  coneGeometry.setIndex([0, 1, 2]);
  coneGeometry.computeVertexNormals();
  const cone = new THREE.Mesh(coneGeometry, transientBasicMaterial({ color: '#ff5964', transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
  cone.name = 'title-sentry-vision';
  cone.renderOrder = -4;

  group.add(cone, body);
  return group;
}

function transientBasicMaterial(parameters: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ depthWrite: false, ...parameters });
  markTransientMaterial(material);
  return material;
}

function transientLineMaterial(color: THREE.ColorRepresentation, opacity: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
  });
  markTransientMaterial(material);
  return material;
}

function prepareTitleHeroPreviewMaterials(object: THREE.Object3D, boosted: boolean): void {
  const accent = new THREE.Color('#53ffe2');
  const lift = new THREE.Color('#dffcff');
  object.traverse((child) => {
    if (child instanceof THREE.PointLight && child.name.startsWith('character-accent-light')) {
      child.intensity = Math.min(child.intensity, boosted ? 0.85 : 1.8);
      return;
    }

    if (!(child instanceof THREE.Mesh)) return;

    child.frustumCulled = false;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const previewMaterials = materials.map((material) => {
      const preview = material.clone();
      markTransientMaterial(preview);
      boostPreviewMaterial(preview, accent, lift, boosted);
      preview.needsUpdate = true;
      return preview;
    });
    child.material = Array.isArray(child.material) ? previewMaterials : previewMaterials[0];
  });
}

function boostPreviewMaterial(material: THREE.Material, accent: THREE.Color, lift: THREE.Color, boosted: boolean): void {
  const colorMaterial = material as THREE.Material & { color?: THREE.Color };
  if (colorMaterial.color instanceof THREE.Color) {
    colorMaterial.color.lerp(lift, boosted ? 0.12 : 0.14);
  }

  const emissiveMaterial = material as THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number };
  if (emissiveMaterial.emissive instanceof THREE.Color) {
    emissiveMaterial.emissive.lerp(accent, boosted ? 0.24 : 0.38);
    emissiveMaterial.emissiveIntensity = Math.max(emissiveMaterial.emissiveIntensity ?? 0, boosted ? 0.45 : 0.75);
  }

  const physicallyLit = material as THREE.Material & { roughness?: number; metalness?: number };
  if (typeof physicallyLit.roughness === 'number') {
    physicallyLit.roughness = Math.min(physicallyLit.roughness, boosted ? 0.62 : 0.64);
  }
  if (typeof physicallyLit.metalness === 'number') {
    physicallyLit.metalness = Math.min(physicallyLit.metalness, boosted ? 0.68 : 0.7);
  }

  material.toneMapped = true;
}

function markTransientMaterial(material: THREE.Material): void {
  material.userData.shadowCircuitTransient = true;
}

function isTransientMaterial(material: THREE.Material): boolean {
  return material.userData.shadowCircuitTransient === true;
}

type ResourceDisposalState = {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
};

function createResourceDisposalState(): ResourceDisposalState {
  return {
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
  };
}

function disposeTransientObjectResources(object: THREE.Object3D, disposal = createResourceDisposalState()): void {
  object.traverse((child) => {
    const insideSharedCachedAsset = isInsideSharedCachedAsset(child, object);

    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line || child instanceof THREE.Sprite) {
      if (!insideSharedCachedAsset) {
        disposeGeometry(child.geometry, disposal);
      }
      disposeMaterial(child.material, disposal, insideSharedCachedAsset);
    }
  });
}

function disposeGeometry(geometry: THREE.BufferGeometry | undefined, disposal: ResourceDisposalState): void {
  if (!geometry || disposal.geometries.has(geometry)) return;

  geometry.dispose();
  disposal.geometries.add(geometry);
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined, disposal: ResourceDisposalState, preserveShared = false): void {
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  materials.forEach((entry) => {
    if (preserveShared && !isTransientMaterial(entry)) return;
    if (disposal.materials.has(entry)) return;
    entry.dispose();
    disposal.materials.add(entry);
  });
}

function isSharedCachedAssetRoot(object: THREE.Object3D): boolean {
  return (
    (object.name.startsWith('player:') && object.name.endsWith(':cinematic')) ||
    (object.name.startsWith('enemy:') && object.name.endsWith(':cinematic')) ||
    (object.name.startsWith('objective:') && object.name.endsWith(':cinematic')) ||
    object.name.includes(':cinematic')
  );
}

function isInsideSharedCachedAsset(object: THREE.Object3D, root: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (isSharedCachedAssetRoot(current)) return true;
    if (current === root) return false;
    current = current.parent;
  }
  return false;
}

function dampAngle(current: number, target: number, factor: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * factor;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clearPlayerStorageData(): void {
  try {
    for (const key of [...progressionStorageKeys, legacyFirstRunTutorialStorageKey, versionedFeaturesStorageKey]) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in private or quota-limited browser sessions.
  }
}
