import * as THREE from 'three';
import { MusicDirector } from './audio';
import { CharacterAssetLibrary, type CharacterAnimator } from './characterAssets';
import { collidesWithEnemies, collidesWithObstacles, enemyRadius, playerRadius } from './collision';
import { DebugPanel } from './debug';
import { advanceSuspicion, emptySuspicion, getDetectionState, isSightBlocked } from './detection';
import { InputController } from './input';
import { levels } from './levels';
import { runLoadingSequence, type LoadingTask } from './loading';
import { add, clampToRoom, distance, normalize, scale, subtract } from './math';
import { collectNearbyObjectives, getObjectiveProgress } from './objectives';
import { ObjectiveAssetLibrary } from './objectiveAssets';
import { isLoadingPhase, isPlayingPhase } from './phase';
import {
  beginPickupFrameProbe,
  createPickupDebugSample,
  emptyPickupDebugSample,
  updatePickupFrameProbe,
  type PickupDebugSample,
  type PickupFrameProbe,
} from './pickupDiagnostics';
import { createRunSummary, loadBestTime, saveBestTime } from './runStats';
import { loadSettings, memoryCapMb, qualityProfile, saveSettings } from './settings';
import { createContactShadowMaterial, createFloorShaderMaterial, createGoalBeaconMaterial, createVisionConeGeometry } from './shaders';
import type {
  DebugSample,
  DetectionState,
  EnemySpec,
  GamePhase,
  GameSettings,
  LevelDefinition,
  ObjectiveDefinition,
  ObjectiveProgress,
  LightSpec,
  LoadingProgress,
  RunSummary,
  SuspicionState,
  Vec2,
} from './types';
import { GameUi } from './ui';

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
  glow: THREE.PointLight;
};

const enemyHoverBaseY = 0.72;
const enemyHoverAmplitude = 0.12;
const enemyHoverSpeed = 1.45;

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
      titleHero: () => { visible: boolean; cinematic: boolean; activeState: string | null; clipNames: readonly string[] };
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
      activeTrackId: () => GameSettings['soundtrackId'] | null;
      musicPlayback: () => {
        activeTrackId: GameSettings['soundtrackId'] | null;
        paused: boolean;
        readyState: number;
        errorCode: number | null;
        volume: number;
      };
      musicEnabled: () => boolean;
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
  private readonly ui: GameUi;
  private readonly debugPanel: DebugPanel;
  private readonly clock = new THREE.Clock();

  private settings: GameSettings = loadSettings();
  private phase: GamePhase = 'menu';
  private settingsReturnPhase: GamePhase = 'menu';
  private levelSelectReturnPhase: GamePhase = 'menu';
  private loadingProgress: LoadingProgress = { value: 0, label: 'Starting systems' };
  private levelIndex = 0;
  private playerPosition: Vec2 = { ...levels[0].start };
  private readonly titlePreview = new THREE.Group();
  private titleHeroVisual: THREE.Object3D | null = null;
  private titleHeroAnimator: CharacterAnimator | null = null;
  private titlePreviewPromise: Promise<void> | null = null;
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
  private debugRays = new THREE.Group();
  private currentDetection: DetectionState = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
  private currentSuspicion: SuspicionState = emptySuspicion();
  private runStartedAt = 0;
  private runAlertCount = 0;
  private runSummary: RunSummary | null = null;
  private lastHudSecond = -1;
  private latestDebugSample: DebugSample | null = null;
  private pickupDebug: PickupDebugSample = emptyPickupDebugSample();
  private pickupFrameProbe: PickupFrameProbe | null = null;
  private qualityMemoryReserve: Float32Array | null = null;
  private reservedMemoryMb = 0;
  private memoryPressureWarned = false;
  private firstLevelBriefingSeen = false;
  private heroDebugView = false;
  private enemyDebugView = false;
  private animationId = 0;
  private disposed = false;

  constructor(mount: HTMLElement) {
    this.ui = new GameUi(mount, this.settings, {
      onStart: () => void this.start(),
      onBeginBriefing: () => void this.beginBriefedRun(),
      onResume: () => this.setPhase(this.settingsReturnPhase),
      onSettings: () => this.openSettings(),
      onMenu: () => this.openMenu(),
      onTitle: () => this.returnToTitle(),
      onLevelSelect: () => this.openLevelSelect(),
      onLevelSelectBack: () => this.setPhase(this.levelSelectReturnPhase),
      onSelectLevel: (levelIndex) => void this.selectLevel(levelIndex),
      onRestart: () => void this.retryLevel(),
      onNextLevel: () => void this.nextLevel(),
      onStartOver: () => void this.startOver(),
      onToggleMute: () => void this.toggleMute(),
      onSettingsChange: (settings) => void this.applySettings(settings),
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
    console.info('[game] Shadow Circuit initialized');
  }

  run(): void {
    this.clock.start();
    this.animationId = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleHotkeys);
    this.input.dispose();
    this.music.stop();
    this.characterAssets.dispose();
    this.objectiveAssets.dispose();
    this.renderer.dispose();
    this.qualityMemoryReserve = null;
    delete window.__shadowCircuitDebug;
  }

  private async start(): Promise<void> {
    if (this.levelIndex === 0 && !this.firstLevelBriefingSeen) {
      this.setPhase('briefing');
      return;
    }

    await this.startPreparedRun(this.levelIndex);
  }

  private async beginBriefedRun(): Promise<void> {
    this.firstLevelBriefingSeen = true;
    await this.startPreparedRun(0);
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.renderUi();
    console.info(`[game] phase=${phase} level=${this.level.id}`);
  }

  private openSettings(): void {
    if (this.isTransitioning()) return;

    this.settingsReturnPhase = this.phase === 'settings' ? this.settingsReturnPhase : this.phase;
    this.setPhase('settings');
  }

  private openMenu(): void {
    if (this.isTransitioning()) return;

    this.showTitleScene();
    this.setPhase('menu');
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

    this.settings = settings;
    this.ui.setSettings(settings);
    saveSettings(settings);
    this.applyRendererQuality();
    if (qualityChanged) {
      if (settings.quality !== 'cinematic' || this.objectiveAssets.hasCinematicAssets()) {
        this.rebuildObjectiveMeshes();
      }
      if (settings.quality !== 'cinematic' || this.characterAssets.hasCinematicAssets()) {
        this.rebuildCharacterMeshes();
      }
    }
    if (audioChanged) {
      this.music.warmupEffects(settings);
      await this.music.sync(settings);
    }
    this.renderUi();
    console.info(`[settings] quality=${settings.quality} music=${settings.musicEnabled} debug=${settings.debugEnabled}`);
  }

  private async toggleMute(): Promise<void> {
    await this.applySettings({ ...this.settings, musicEnabled: !this.settings.musicEnabled });
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

    this.showTitleScene();
    this.setPhase('menu');
  }

  private async startOver(): Promise<void> {
    await this.startPreparedRun(0);
  }

  private async selectLevel(levelIndex: number): Promise<void> {
    await this.startPreparedRun(levelIndex);
  }

  private async startPreparedRun(levelIndex: number): Promise<void> {
    if (this.isTransitioning()) return;

    await this.loadLevelWithTransition(levelIndex);
    if (this.disposed) return;

    this.beginRun();
    this.setPhase('playing');
    this.music.warmupEffects(this.settings);
    await this.music.sync(this.settings);
  }

  private async loadLevelWithTransition(levelIndex: number): Promise<void> {
    const targetIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
    const targetLevel = levels[targetIndex];
    this.loadingProgress = { value: 0, label: `Loading ${targetLevel.name}` };
    this.setPhase('loading');

    await runLoadingSequence({
      tasks: this.levelTransitionTasks(targetIndex),
      onProgress: (progress) => this.updateLoadingProgress(progress),
      shouldCancel: () => this.disposed,
      minDurationMs: 950,
      minTaskMs: 150,
      readyDelayMs: 140,
    });
  }

  private levelTransitionTasks(levelIndex: number): readonly LoadingTask[] {
    const targetLevel = levels[levelIndex];
    return [
      { label: 'Loading character assets', run: () => this.characterAssets.preload(this.settings.quality) },
      { label: 'Loading objective assets', run: () => this.objectiveAssets.preload(this.settings.quality) },
      { label: `Loading ${targetLevel.name}`, run: () => this.loadLevel(levelIndex) },
      { label: 'Loading soundtrack', run: () => this.music.preload(this.settings) },
      { label: 'Compiling level materials', run: () => this.warmupRenderStates() },
      { label: 'Priming objective states', run: () => this.warmupObjectiveStates() },
      { label: 'Preparing pickup audio', run: () => this.music.preloadPickupCue() },
    ];
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
    void this.prepareTitlePreview();
    this.renderUi();
  }

  private async prepareTitlePreview(): Promise<void> {
    if (this.titleHeroVisual) return;

    this.titlePreviewPromise ??= this.characterAssets.preloadHero()
      .then(() => {
        if (this.disposed) return;
        this.installTitleHeroPreview();
        if (this.phase === 'menu') {
          this.fitCameraToTitle();
        }
      })
      .catch((error: unknown) => {
        this.titlePreviewPromise = null;
        console.warn(`[title] hero preview unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    await this.titlePreviewPromise;
  }

  private installTitleHeroPreview(): void {
    this.titlePreview.clear();
    this.titlePreview.name = 'title-preview';

    const platformMaterial = new THREE.MeshBasicMaterial({ color: '#020405', transparent: true, opacity: 0.64 });
    const platform = new THREE.Mesh(new THREE.CircleGeometry(1.04, 48), platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.position.set(1.45, -0.02, 0);
    platform.name = 'title-hero-platform';

    const key = new THREE.DirectionalLight('#e7fbff', 5.2);
    key.position.set(2.7, 3.6, 3.2);
    key.name = 'title-hero-key-light';

    const rim = new THREE.PointLight('#53ffe2', 5.6, 4.8);
    rim.position.set(0.55, 1.35, 1.35);
    rim.name = 'title-hero-rim-light';

    const fill = new THREE.PointLight('#fff2d0', 4.6, 4.4);
    fill.position.set(1.35, 1.15, 2.15);
    fill.name = 'title-hero-fill-light';

    const character = this.characterAssets.createHero('cinematic');
    this.titleHeroVisual = character.object;
    this.titleHeroAnimator = character.animator;
    this.titleHeroAnimator?.setMotionState('idle', 0);
    this.titleHeroVisual.name = 'title-hero:cinematic';
    this.titleHeroVisual.position.set(1.45, 0, 0);
    this.titleHeroVisual.rotation.y = -0.26;

    this.titlePreview.add(platform, key, rim, fill, this.titleHeroVisual);
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
      point.castShadow = this.settings.quality !== 'memory';
      point.shadow.mapSize.setScalar(qualityProfile(this.settings.quality).shadowMapSize);
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
    const profile = qualityProfile(this.settings.quality);
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

  private warmupRenderStates(): void {
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
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);

    this.goalBeaconMesh.visible = previousGoalBeaconVisible;
    this.objectives.forEach((objective, index) => {
      objective.mesh.visible = previousObjectiveVisibility[index]?.mesh ?? objective.mesh.visible;
      objective.glow.visible = previousObjectiveVisibility[index]?.glow ?? objective.glow.visible;
    });
    this.renderer.compile(this.scene, this.camera);
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
    const profile = qualityProfile(this.settings.quality);
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
    const character = this.characterAssets.createEnemy(spec.id, this.settings.quality);
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
    light.castShadow = this.settings.quality !== 'memory';
    light.shadow.mapSize.setScalar(qualityProfile(this.settings.quality).shadowMapSize);
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
    const isKeycard = spec.type === 'keycard';
    const mesh = this.objectiveAssets.create(spec, this.settings.quality);

    const glow = new THREE.PointLight(isKeycard ? '#ffd45a' : '#5ad7ff', 18, 2.1);
    glow.position.set(spec.position.x, 0.68, spec.position.z);
    glow.name = `objective-glow:${spec.id}`;

    return { spec, mesh, glow };
  }

  private rebuildObjectiveMeshes(): void {
    const specs = this.level.objectives ?? [];
    this.objectives.forEach((objective) => {
      this.scene.remove(objective.mesh, objective.glow);
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

    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
      const character = this.characterAssets.createEnemy(enemy.spec.id, this.settings.quality);
      enemy.mesh = character.object;
      enemy.animator = character.animator;
      this.scene.add(enemy.mesh);
      this.placeEnemy(enemy);
    }
  }

  private refreshPlayerVisual(): void {
    this.playerMesh.clear();
    const character = this.characterAssets.createHero(this.settings.quality);
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

  private collectObjectives(): void {
    const startedAt = performance.now();
    const collectStartedAt = performance.now();
    const next = collectNearbyObjectives(this.level, this.playerPosition, this.collectedObjectiveIds);
    const collectMs = performance.now() - collectStartedAt;
    if (next.size === this.collectedObjectiveIds.size) return;

    const collectedNow = [...next].filter((id) => !this.collectedObjectiveIds.has(id));
    this.collectedObjectiveIds = next;
    const meshStartedAt = performance.now();
    this.updateObjectiveMeshes();
    const meshMs = performance.now() - meshStartedAt;
    const objective = (this.level.objectives ?? []).find((candidate) => collectedNow.includes(candidate.id));
    const progress = this.objectiveProgress();
    this.objectiveNotice = progress.exitUnlocked
      ? `Collected ${objective?.label ?? 'objective'} - exit unlocked`
      : `Collected ${objective?.label ?? 'objective'}`;
    this.objectiveNoticeUntil = performance.now() + 2600;
    const audioStartedAt = performance.now();
    const audioDebug = this.music.playPickup(this.settings);
    const audioMs = performance.now() - audioStartedAt;
    const uiStartedAt = performance.now();
    this.renderUi();
    const uiMs = performance.now() - uiStartedAt;
    const totalMs = performance.now() - startedAt;
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
    this.pickupFrameProbe = beginPickupFrameProbe(startedAt);
    console.info(
      `[objective] collected=${[...this.collectedObjectiveIds].join(',')} pickupMs=${totalMs.toFixed(1)} audioMs=${audioMs.toFixed(1)} uiMs=${uiMs.toFixed(1)}`,
    );
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
    const persistent = new Set<THREE.Object3D>([this.debugRays]);
    for (const child of [...this.scene.children]) {
      if (persistent.has(child) || child instanceof THREE.AmbientLight) continue;
      this.scene.remove(child);
    }
    this.blockers = [];
    this.enemies = [];
    this.objectives = [];
  }

  private updateCharacterAnimations(now: number, delta: number): void {
    if (this.phase === 'menu') {
      this.titleHeroAnimator?.setMotionState('idle');
      this.titleHeroAnimator?.update(delta);
      if (this.titleHeroVisual) {
        const time = now / 1000;
        this.titleHeroVisual.position.y = Math.sin(time * 2.2) * 0.015;
      }
      return;
    }

    if (this.settings.quality !== 'cinematic') return;

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
    if (this.objectiveNotice && now > this.objectiveNoticeUntil) {
      this.objectiveNotice = '';
      this.renderUi();
    }
    if (this.canUpdateRun()) {
      const hudSecond = Math.floor(this.currentRunElapsedMs() / 1000);
      if (hudSecond !== this.lastHudSecond) {
        this.lastHudSecond = hudSecond;
        this.ui.updateRunHud(this.currentRunElapsedMs(), this.runAlertCount);
      }
    }
    this.goalMesh.rotation.y += delta * 0.9;
    this.updateHeroDebugCamera();
    this.updateEnemyDebugCamera();
    this.renderer.render(this.scene, this.camera);

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
    );
    this.renderer.info.reset();

    this.animationId = requestAnimationFrame(this.tick);
  };

  private readonly resize = (): void => {
    const bounds = this.ui.root.getBoundingClientRect();
    const width = Math.max(320, bounds.width);
    const height = Math.max(320, bounds.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.fitCameraToLevel();
    this.camera.updateProjectionMatrix();
  };

  private readonly handleHotkeys = (event: KeyboardEvent): void => {
    if (this.isTransitioning()) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.canUpdateRun()) {
        this.openMenu();
      } else if (this.phase === 'settings') {
        this.setPhase(this.settingsReturnPhase);
      } else if (this.phase === 'level-select') {
        this.setPhase(this.levelSelectReturnPhase);
      }
    }
    if (event.code === 'F1') {
      event.preventDefault();
      void this.applySettings({ ...this.settings, debugEnabled: !this.settings.debugEnabled });
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
    };
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

  private titleHeroDebugState(): { visible: boolean; cinematic: boolean; activeState: string | null; clipNames: readonly string[] } {
    const snapshot = this.titleHeroAnimator?.snapshot();
    return {
      visible: this.phase === 'menu' && this.scene.children.includes(this.titlePreview) && Boolean(this.titleHeroVisual),
      cinematic: this.titleHeroVisual?.name.endsWith(':cinematic') ?? false,
      activeState: snapshot?.activeState ?? null,
      clipNames: snapshot?.clipNames ?? [],
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
    if (this.phase === 'menu') {
      this.fitCameraToTitle();
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

    const scale = Math.max(1, this.level.floorSize.x / 16.5, this.level.floorSize.z / 11.8, this.camera.aspect < 1 ? 1.2 : 1);
    this.camera.position.set(0, 10.2 * scale, 10.4 * scale);
    this.camera.lookAt(0, 0, 0);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 8 * scale;
      this.scene.fog.far = 22 * scale;
    }
  }

  private fitCameraToTitle(): void {
    const aspectOffset = this.camera.aspect < 1 ? 0.65 : 0;
    this.camera.position.set(1.15 + aspectOffset, 1.12, 3.15);
    this.camera.lookAt(1.35, 0.68, 0);
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

  private reportMemoryPressure(usedMemoryMb: number | null): void {
    if (usedMemoryMb === null || usedMemoryMb <= memoryCapMb) {
      this.memoryPressureWarned = false;
      return;
    }

    if (this.memoryPressureWarned) return;

    this.memoryPressureWarned = true;
    console.warn(
      `[performance] memory cap exceeded ${usedMemoryMb.toFixed(1)} MB > ${memoryCapMb} MB; keeping selected ${this.settings.quality} quality`,
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
    this.ui.renderOverlay(this.phase, this.level, levels, this.levelIndex, this.runSummary, this.loadingProgress);
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

  private beginRun(): void {
    this.runStartedAt = performance.now();
    this.runAlertCount = 0;
    this.runSummary = null;
    this.lastHudSecond = -1;
  }

  private currentRunElapsedMs(): number {
    return this.runStartedAt > 0 ? performance.now() - this.runStartedAt : 0;
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

    this.runSummary = summary;
    this.objectiveNotice = '';
    this.objectiveNoticeUntil = 0;
    this.setPhase('complete');
  }

  private recordAlertTransition(previous: SuspicionState['status'], next: SuspicionState['status']): void {
    if (this.canUpdateRun() && previous === 'hidden' && next !== 'hidden') {
      this.runAlertCount += 1;
      this.ui.updateRunHud(this.currentRunElapsedMs(), this.runAlertCount);
    }
  }
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

function dampAngle(current: number, target: number, factor: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * factor;
}
