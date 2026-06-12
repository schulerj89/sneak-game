import * as THREE from 'three';
import { MusicDirector } from './audio';
import { DebugPanel } from './debug';
import { getDetectionState, isSightBlocked } from './detection';
import { InputController } from './input';
import { levels } from './levels';
import { add, clampToRoom, distance, normalize, pointInRect, scale, subtract } from './math';
import { loadSettings, memoryCapMb, qualityProfile, saveSettings } from './settings';
import type { DebugSample, DetectionState, EnemySpec, GamePhase, GameSettings, LevelDefinition, Vec2 } from './types';
import { GameUi } from './ui';

type EnemyRuntime = {
  spec: EnemySpec;
  mesh: THREE.Mesh;
  cone: THREE.Mesh;
  light: THREE.SpotLight;
  position: Vec2;
  facing: Vec2;
  patrolIndex: number;
  pauseRemaining: number;
};

const playerRadius = 0.28;

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
  private goalMesh = new THREE.Mesh();
  private enemies: EnemyRuntime[] = [];
  private blockers: THREE.Mesh[] = [];
  private debugRays = new THREE.Group();
  private currentDetection: DetectionState = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
  private latestDebugSample: DebugSample | null = null;
  private animationId = 0;

  constructor(mount: HTMLElement) {
    this.ui = new GameUi(mount, this.settings, {
      onStart: () => void this.start(),
      onResume: () => this.setPhase(this.settingsReturnPhase),
      onSettings: () => this.openSettings(),
      onMenu: () => this.setPhase('menu'),
      onLevelSelect: () => this.openLevelSelect(),
      onLevelSelectBack: () => this.setPhase(this.levelSelectReturnPhase),
      onSelectLevel: (levelIndex) => this.selectLevel(levelIndex),
      onRestart: () => this.retryLevel(),
      onNextLevel: () => this.nextLevel(),
      onSettingsChange: (settings) => void this.applySettings(settings),
    });
    this.debugPanel = new DebugPanel(this.ui.debug);
    this.renderer = this.createRenderer();
    this.ui.root.appendChild(this.renderer.domElement);

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
    delete window.__shadowCircuitDebug;
  }

  private async start(): Promise<void> {
    this.restartLevel();
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
    this.enemies.forEach((enemy) => {
      enemy.position = { ...enemy.spec.start };
      enemy.facing = normalize(subtract(enemy.spec.patrol[1] ?? enemy.spec.start, enemy.spec.start));
      enemy.patrolIndex = 1;
      enemy.pauseRemaining = 0;
      this.placeEnemy(enemy);
    });
    this.currentDetection = { spotted: false, enemyId: null, rayBlocked: false, distance: Infinity };
    console.info(`[level] restarted ${this.level.id}`);
  }

  private retryLevel(): void {
    this.restartLevel();
    this.setPhase('playing');
  }

  private nextLevel(): void {
    this.loadLevel((this.levelIndex + 1) % levels.length);
    this.setPhase('playing');
  }

  private selectLevel(levelIndex: number): void {
    this.loadLevel(levelIndex);
    this.setPhase('playing');
  }

  private loadLevel(index: number): void {
    this.levelIndex = index;
    this.clearLevelObjects();
    const level = this.level;
    this.playerPosition = { ...level.start };

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(level.floorSize.x, 0.12, level.floorSize.z),
      new THREE.MeshStandardMaterial({ color: '#10141c', roughness: 0.86, metalness: 0.08 }),
    );
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
      point.name = `light:${light.id}`;
      this.scene.add(point);

      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshStandardMaterial({ color: light.color, emissive: light.color, emissiveIntensity: 0.7 }),
      );
      lamp.position.copy(point.position);
      lamp.name = 'level-object';
      this.scene.add(lamp);
    }

    this.goalMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(level.goalRadius, level.goalRadius, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: '#7dff9b', emissive: '#1a6f34', emissiveIntensity: 0.85 }),
    );
    this.goalMesh.position.set(level.goal.x, 0.08, level.goal.z);
    this.goalMesh.name = 'goal';
    this.scene.add(this.goalMesh);
    const goalBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(level.goalRadius * 0.58, level.goalRadius * 0.58, 0.95, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#8eff81',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    goalBeacon.position.set(level.goal.x, 0.52, level.goal.z);
    goalBeacon.name = 'goal-beacon';
    this.scene.add(goalBeacon);

    this.playerMesh.castShadow = true;
    this.playerMesh.name = 'player';
    this.scene.add(this.playerMesh);

    this.enemies = level.enemies.map((enemy) => this.createEnemy(enemy));
    this.enemies.forEach((enemy) => {
      this.scene.add(enemy.mesh, enemy.cone, enemy.light);
      this.placeEnemy(enemy);
    });

    this.restartLevel();
    this.renderUi();
    console.info(`[level] loaded ${level.id} blockers=${this.blockers.length} enemies=${this.enemies.length}`);
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color('#03050a');
    this.scene.fog = new THREE.Fog('#03050a', 8, 22);
    this.camera.position.set(0, 8.6, 8.8);
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
    for (const light of this.scene.children) {
      if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        light.castShadow = profile.shadows;
      }
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
    light.name = `vision-light:${spec.id}`;

    return {
      spec,
      mesh,
      cone,
      light,
      position: { ...spec.start },
      facing: normalize(subtract(spec.patrol[1] ?? spec.start, spec.start)),
      patrolIndex: 1,
      pauseRemaining: 0,
    };
  }

  private updatePlayer(delta: number): void {
    if (this.phase !== 'playing') return;

    const movement = this.input.movement();
    const next = add(this.playerPosition, scale(movement, delta * 2.4));
    const clamped = clampToRoom(next, this.level.floorSize, playerRadius);
    const collides = this.level.obstacles.some((obstacle) => pointInRect(clamped, obstacle, playerRadius));
    if (!collides) {
      this.playerPosition = clamped;
      this.playerMesh.position.set(clamped.x, 0.48, clamped.z);
    }

    if (distance(this.playerPosition, this.level.goal) <= this.level.goalRadius + playerRadius) {
      this.setPhase('complete');
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
        enemy.position = add(enemy.position, scale(enemy.facing, Math.min(remaining, enemy.spec.speed * delta)));
      }
      this.placeEnemy(enemy);
    }
  }

  private updateDetection(): void {
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
    if (nearest.spotted && this.phase === 'playing') {
      this.setPhase('caught');
      console.warn(`[detection] player spotted by ${nearest.enemyId}`);
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
  }

  private readonly tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateDetection();
    this.updateDebugRays();
    this.goalMesh.rotation.y += delta * 0.9;
    this.renderer.render(this.scene, this.camera);

    const sample = this.debugPanel.sample(now, this.renderer.info.render.calls, this.renderer.info.render.triangles);
    this.latestDebugSample = sample;
    this.enforceMemoryCap(sample.usedMemoryMb);
    this.debugPanel.render(this.settings, this.level, this.playerPosition, this.currentDetection, sample);
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
    };
  }

  private isGoalVisibleInCamera(): boolean {
    this.camera.updateMatrixWorld();
    this.goalMesh.updateMatrixWorld();
    const position = this.goalMesh.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z >= -1 && position.z <= 1;
  }

  private enforceMemoryCap(usedMemoryMb: number | null): void {
    if (usedMemoryMb === null || usedMemoryMb <= memoryCapMb || this.settings.quality === 'memory') return;

    void this.applySettings({ ...this.settings, quality: 'memory' });
    console.warn(`[performance] memory cap exceeded ${usedMemoryMb.toFixed(1)} MB > ${memoryCapMb} MB; downgraded to memory quality`);
  }

  private renderUi(): void {
    this.ui.renderHud(this.level, this.levelIndex, this.phase, levels.length);
    this.ui.renderOverlay(this.phase, this.level, levels, this.levelIndex);
  }

  private get level(): LevelDefinition {
    return levels[this.levelIndex];
  }
}

function createVisionConeGeometry(range: number, angleDegrees: number): THREE.BufferGeometry {
  const segments = 24;
  const half = (angleDegrees * Math.PI) / 360;
  const vertices: number[] = [0, 0, 0];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = -half + (index / segments) * half * 2;
    vertices.push(Math.sin(angle) * range, 0, Math.cos(angle) * range);
    if (index > 0) {
      indices.push(0, index, index + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
