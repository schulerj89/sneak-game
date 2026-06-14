import * as THREE from 'three';
import { MusicDirector } from './audio';
import { collidesWithEnemies, collidesWithObstacles, enemyRadius, playerRadius } from './collision';
import { DebugPanel } from './debug';
import { advanceSuspicion, emptySuspicion, getDetectionState, isSightBlocked } from './detection';
import { InputController } from './input';
import { levels } from './levels';
import { add, clampToRoom, distance, normalize, scale, subtract } from './math';
import { collectNearbyObjectives, getObjectiveProgress } from './objectives';
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
  RunSummary,
  SuspicionState,
  Vec2,
} from './types';
import { GameUi } from './ui';

type EnemyRuntime = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  cone: THREE.Mesh;
  light: THREE.SpotLight;
  contactShadow: THREE.Mesh;
  position: Vec2;
  facing: Vec2;
  patrolIndex: number;
  pauseRemaining: number;
};

type ObjectiveRuntime = {
  spec: ObjectiveDefinition;
  mesh: THREE.Mesh;
  glow: THREE.PointLight;
};

declare global {
  interface Window {
    __shadowCircuitDebug?: {
      forceCaught: () => void;
      phase: () => GamePhase;
      selectLevel: (levelIndex: number) => void;
      levelCount: () => number;
      performance: () => DebugSample | null;
      levelId: () => string;
      goalVisible: () => boolean;
      playerVisible: () => boolean;
      forceEnemyCollision: () => void;
      suspicion: () => SuspicionState;
      objectives: () => ObjectiveProgress;
      goalLit: () => boolean;
      movePlayerTo: (point: Vec2) => void;
      playerPosition: () => Vec2;
      activeTrackId: () => GameSettings['soundtrackId'] | null;
    };
  }
}

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
  private renderer: THREE.WebGLRenderer;
  private readonly input = new InputController();
  private readonly music = new MusicDirector();
  private readonly ui: GameUi;
  private readonly debugPanel: DebugPanel;
  private readonly clock = new THREE.Clock();

  private settings: GameSettings = loadSettings();
  private phase: GamePhase = 'menu';
  private settingsReturnPhase: GamePhase = 'menu';
  private levelSelectReturnPhase: GamePhase = 'menu';
  private levelIndex = 0;
  private playerPosition: Vec2 = { ...levels[0].start };
  private readonly playerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.32, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#7dfcc6', emissive: '#12382f', roughness: 0.55 }),
  );
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
  private qualityMemoryReserve: Float32Array | null = null;
  private reservedMemoryMb = 0;
  private animationId = 0;

  constructor(mount: HTMLElement) {
    this.ui = new GameUi(mount, this.settings, {
      onStart: () => void this.start(),
      onResume: () => this.setPhase(this.settingsReturnPhase),
      onSettings: () => this.openSettings(),
      onMenu: () => this.setPhase('menu'),
      onTitle: () => this.returnToTitle(),
      onLevelSelect: () => this.openLevelSelect(),
      onLevelSelectBack: () => this.setPhase(this.levelSelectReturnPhase),
      onSelectLevel: (levelIndex) => void this.selectLevel(levelIndex),
      onRestart: () => void this.retryLevel(),
      onNextLevel: () => void this.nextLevel(),
      onStartOver: () => void this.startOver(),
      onSettingsChange: (settings) => void this.applySettings(settings),
    });
    this.debugPanel = new DebugPanel(this.ui.debug);
    this.renderer = this.createRenderer();
    this.ui.root.appendChild(this.renderer.domElement);
    this.applyRendererQuality();

    this.setupScene();
    this.loadLevel(0);
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
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleHotkeys);
    this.input.dispose();
    this.music.stop();
    this.renderer.dispose();
    this.qualityMemoryReserve = null;
    delete window.__shadowCircuitDebug;
  }

  private async start(): Promise<void> {
    this.restartLevel();
    this.beginRun();
    this.setPhase('playing');
    await this.music.sync(this.settings);
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.renderUi();
    console.info(`[game] phase=${phase} level=${this.level.id}`);
  }

  private openSettings(): void {
    this.settingsReturnPhase = this.phase === 'settings' ? this.settingsReturnPhase : this.phase;
    this.setPhase('settings');
  }

  private openLevelSelect(): void {
    this.levelSelectReturnPhase = this.phase === 'level-select' ? this.levelSelectReturnPhase : this.phase;
    this.setPhase('level-select');
  }

  private async applySettings(settings: GameSettings): Promise<void> {
    this.settings = settings;
    this.ui.setSettings(settings);
    saveSettings(settings);
    this.applyRendererQuality();
    await this.music.sync(settings);
    this.renderUi();
    console.info(`[settings] quality=${settings.quality} music=${settings.musicEnabled} debug=${settings.debugEnabled}`);
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
    this.restartLevel();
    this.beginRun();
    this.setPhase('playing');
    await this.music.sync(this.settings);
  }

  private async nextLevel(): Promise<void> {
    if (this.levelIndex >= levels.length - 1) {
      this.returnToTitle();
      return;
    }

    this.loadLevel(this.levelIndex + 1);
    this.beginRun();
    this.setPhase('playing');
    await this.music.sync(this.settings);
  }

  private returnToTitle(): void {
    this.loadLevel(0);
    this.setPhase('menu');
  }

  private async startOver(): Promise<void> {
    this.loadLevel(0);
    this.beginRun();
    this.setPhase('playing');
    await this.music.sync(this.settings);
  }

  private async selectLevel(levelIndex: number): Promise<void> {
    this.loadLevel(levelIndex);
    this.beginRun();
    this.setPhase('playing');
    await this.music.sync(this.settings);
  }

  private loadLevel(index: number): void {
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

      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: '#5d6877', emissive: '#111722', emissiveIntensity: 0.25, roughness: 0.42 }),
      );
      fixture.position.copy(point.position);
      fixture.name = `light-fixture:${light.id}`;
      this.scene.add(fixture);
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

    this.playerMesh.castShadow = true;
    this.playerMesh.name = 'player';
    this.scene.add(this.playerMesh, this.playerContactShadow);

    this.enemies = level.enemies.map((enemy) => this.createEnemy(enemy));
    this.enemies.forEach((enemy) => {
      this.scene.add(enemy.mesh, enemy.cone, enemy.light, enemy.contactShadow);
      this.placeEnemy(enemy);
    });

    this.restartLevel();
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
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.8, 5),
      new THREE.MeshStandardMaterial({ color: '#ff5964', emissive: '#441219', roughness: 0.52 }),
    );
    mesh.castShadow = true;
    mesh.rotation.x = Math.PI;
    mesh.name = `enemy:${spec.id}`;

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

    const light = new THREE.SpotLight('#ffcf5a', 24, spec.visionRange, (spec.visionAngleDegrees * Math.PI) / 360, 0.55, 1.8);
    light.castShadow = this.settings.quality !== 'memory';
    light.shadow.mapSize.setScalar(qualityProfile(this.settings.quality).shadowMapSize);
    light.name = `vision-light:${spec.id}`;
    const contactShadow = createContactShadow(0.82, 0.62, 0.25);

    return {
      spec,
      mesh,
      cone,
      light,
      contactShadow,
      position: { ...spec.start },
      facing: normalize(subtract(spec.patrol[1] ?? spec.start, spec.start)),
      patrolIndex: 1,
      pauseRemaining: 0,
    };
  }

  private createObjective(spec: ObjectiveDefinition): ObjectiveRuntime {
    const isKeycard = spec.type === 'keycard';
    const mesh = new THREE.Mesh(
      isKeycard ? new THREE.BoxGeometry(0.52, 0.08, 0.32) : new THREE.CylinderGeometry(0.28, 0.28, 0.12, 6),
      new THREE.MeshStandardMaterial({
        color: isKeycard ? '#ffd45a' : '#5ad7ff',
        emissive: isKeycard ? '#6d4c08' : '#063f58',
        emissiveIntensity: 0.9,
        roughness: 0.38,
        metalness: 0.18,
      }),
    );
    mesh.position.set(spec.position.x, 0.16, spec.position.z);
    mesh.rotation.y = isKeycard ? -0.35 : Math.PI / 6;
    mesh.name = `objective:${spec.id}`;

    const glow = new THREE.PointLight(isKeycard ? '#ffd45a' : '#5ad7ff', 18, 2.1);
    glow.position.set(spec.position.x, 0.68, spec.position.z);
    glow.name = `objective-glow:${spec.id}`;

    return { spec, mesh, glow };
  }

  private updatePlayer(delta: number): void {
    if (this.phase !== 'playing') return;

    const movement = this.input.movement();
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
    if (this.phase !== 'playing') return;

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
    if (this.phase !== 'playing') return;

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
    if (this.currentSuspicion.status === 'detected' && this.phase === 'playing') {
      this.setPhase('caught');
      console.warn(`[detection] player detected by ${this.currentSuspicion.enemyId}`);
    }

    const collision = collidesWithEnemies(this.playerPosition, this.enemyBodies(), playerRadius);
    if (collision && this.phase === 'playing') {
      this.currentDetection = { spotted: true, enemyId: collision.id, rayBlocked: false, distance: 0 };
      this.recordAlertTransition(this.currentSuspicion.status, 'detected');
      this.currentSuspicion = { value: 1, status: 'detected', enemyId: collision.id };
      this.setPhase('caught');
      console.warn(`[collision] player collided with ${collision.id}`);
    }
  }

  private collectObjectives(): void {
    const next = collectNearbyObjectives(this.level, this.playerPosition, this.collectedObjectiveIds);
    if (next.size === this.collectedObjectiveIds.size) return;

    const collectedNow = [...next].filter((id) => !this.collectedObjectiveIds.has(id));
    this.collectedObjectiveIds = next;
    this.updateObjectiveMeshes();
    const objective = (this.level.objectives ?? []).find((candidate) => collectedNow.includes(candidate.id));
    const progress = this.objectiveProgress();
    this.objectiveNotice = progress.exitUnlocked
      ? `Collected ${objective?.label ?? 'objective'} - exit unlocked`
      : `Collected ${objective?.label ?? 'objective'}`;
    this.objectiveNoticeUntil = performance.now() + 2600;
    this.music.playPickup(this.settings);
    this.renderUi();
    console.info(`[objective] collected=${[...this.collectedObjectiveIds].join(',')}`);
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

  private placeEnemy(enemy: EnemyRuntime): void {
    enemy.mesh.position.set(enemy.position.x, 0.55, enemy.position.z);
    enemy.mesh.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
    enemy.cone.position.set(enemy.position.x, 0.035, enemy.position.z);
    enemy.cone.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.z);
    enemy.contactShadow.position.set(enemy.position.x, 0.018, enemy.position.z);
    enemy.light.position.set(enemy.position.x, 1.1, enemy.position.z);
    enemy.light.target.position.set(enemy.position.x + enemy.facing.x, 0.25, enemy.position.z + enemy.facing.z);
    this.scene.add(enemy.light.target);
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

  private readonly tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateDetection(delta);
    this.updateDebugRays();
    if (this.objectiveNotice && now > this.objectiveNoticeUntil) {
      this.objectiveNotice = '';
      this.renderUi();
    }
    if (this.phase === 'playing') {
      const hudSecond = Math.floor(this.currentRunElapsedMs() / 1000);
      if (hudSecond !== this.lastHudSecond) {
        this.lastHudSecond = hudSecond;
        this.ui.updateRunHud(this.currentRunElapsedMs(), this.runAlertCount);
      }
    }
    this.goalMesh.rotation.y += delta * 0.9;
    this.renderer.render(this.scene, this.camera);

    const sample = this.debugPanel.sample(now, this.renderer.info.render.calls, this.renderer.info.render.triangles, this.reservedMemoryMb);
    this.latestDebugSample = sample;
    this.enforceMemoryCap(sample.usedMemoryMb);
    this.debugPanel.render(this.settings, this.level, this.playerPosition, this.currentDetection, this.currentSuspicion, this.objectiveProgress(), sample);
    this.renderer.info.reset();

    this.animationId = requestAnimationFrame(this.tick);
  };

  private readonly resize = (): void => {
    const bounds = this.ui.root.getBoundingClientRect();
    const width = Math.max(320, bounds.width);
    const height = Math.max(320, bounds.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly handleHotkeys = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.setPhase(this.phase === 'playing' ? 'menu' : 'playing');
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
      performance: () => this.latestDebugSample,
      levelId: () => this.level.id,
      goalVisible: () => this.isGoalVisibleInCamera(),
      playerVisible: () => this.isPlayerVisibleInCamera(),
      forceEnemyCollision: () => this.forceEnemyCollision(),
      suspicion: () => this.currentSuspicion,
      objectives: () => this.objectiveProgress(),
      goalLit: () => this.goalBeaconMesh.visible,
      movePlayerTo: (point: Vec2) => this.movePlayerTo(point),
      playerPosition: () => this.playerPosition,
      activeTrackId: () => this.music.currentTrack(),
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

  private isGoalVisibleInCamera(): boolean {
    return this.isObjectVisibleInCamera(this.goalMesh);
  }

  private isPlayerVisibleInCamera(): boolean {
    return this.isObjectVisibleInCamera(this.playerMesh);
  }

  private isObjectVisibleInCamera(object: THREE.Object3D): boolean {
    this.camera.updateMatrixWorld();
    object.updateMatrixWorld();
    const position = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z >= -1 && position.z <= 1;
  }

  private enforceMemoryCap(usedMemoryMb: number | null): void {
    if (usedMemoryMb === null || usedMemoryMb <= memoryCapMb || this.settings.quality === 'memory') return;

    void this.applySettings({ ...this.settings, quality: 'memory' });
    console.warn(`[performance] memory cap exceeded ${usedMemoryMb.toFixed(1)} MB > ${memoryCapMb} MB; downgraded to memory quality`);
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
    this.ui.renderOverlay(this.phase, this.level, levels, this.levelIndex, this.runSummary);
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
    if (this.phase === 'playing' && previous === 'hidden' && next !== 'hidden') {
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
