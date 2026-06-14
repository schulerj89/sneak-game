import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader ??= NodeFileReader as unknown as typeof FileReader;

type MeshyCreateResponse = {
  result?: string;
  message?: string;
};

type MeshyModelTask = {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELED';
  progress?: number;
  model_urls?: {
    glb?: string;
  };
  task_error?: {
    message?: string;
  };
};

type MeshyRigTask = {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress?: number;
  result?: {
    rigged_character_glb_url?: string;
    basic_animations?: {
      walking_glb_url?: string;
      running_glb_url?: string;
    };
  };
  task_error?: {
    message?: string;
  };
};

type MeshyAnimationTask = {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress?: number;
  result?: {
    animation_glb_url?: string;
  };
  task_error?: {
    message?: string;
  };
};

type CharacterPlan = Readonly<{
  id: 'hero' | 'sentry';
  fileName: string;
  targetPolycount: number;
  prompt: string;
  texturePrompt: string;
  animationActionId: number;
}>;

const textTo3dBaseUrl = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const riggingBaseUrl = 'https://api.meshy.ai/openapi/v1/rigging';
const animationBaseUrl = 'https://api.meshy.ai/openapi/v1/animations';
const args = new Set(process.argv.slice(2));
const fallback =
  args.has('--fallback') ||
  process.env.MESHY_CHARACTER_FALLBACK === 'true' ||
  process.env.npm_config_fallback === 'true';
const refine = args.has('--refine');
const skipAnimation = args.has('--skip-animation');
const apiKey = process.env.MESHY_API_KEY ?? '';
const maxAssetBytes = Number(process.env.MESHY_MAX_CHARACTER_BYTES ?? 180_000);
const outputDir = 'src/assets/characters';

const plans: readonly CharacterPlan[] = [
  {
    id: 'hero',
    fileName: 'hero-cinematic.glb',
    targetPolycount: 1800,
    prompt:
      'low-poly humanoid stealth infiltrator hero for top-down cyberpunk game, teal sneaking suit, clear limbs, visor, compact backpack, face toward positive Z, isolated character, no weapon, no text',
    texturePrompt:
      'dark teal stealth suit with cyan visor, subtle green circuit seams, readable compact game character, no logos or text',
    animationActionId: 30,
  },
  {
    id: 'sentry',
    fileName: 'sentry-cinematic.glb',
    targetPolycount: 1700,
    prompt:
      'low-poly humanoid security sentry enemy for top-down cyberpunk stealth game, red armor, helmet visor, clear arms and legs, face toward positive Z, isolated character, no weapon, no text',
    texturePrompt:
      'red security armor with amber visor and black metal joints, readable compact game enemy, no logos or text',
    animationActionId: 2,
  },
];

await mkdir(outputDir, { recursive: true });

if (fallback) {
  await writeFallbackAssets();
} else {
  if (!apiKey) {
    throw new Error('Set MESHY_API_KEY before running npm run assets:meshy-characters, or pass --fallback to write local fallback GLBs.');
  }
  await writeMeshyAssets();
}

async function writeMeshyAssets(): Promise<void> {
  for (const plan of plans) {
    console.info(`[meshy] creating character preview ${plan.id}`);
    const previewTaskId = await createTask(textTo3dBaseUrl, {
      mode: 'preview',
      prompt: plan.prompt,
      ai_model: 'meshy-6',
      should_remesh: true,
      topology: 'quad',
      target_polycount: plan.targetPolycount,
      target_formats: ['glb'],
      moderation: true,
      auto_size: true,
      origin_at: 'bottom',
    });
    const previewTask = await waitForModelTask(previewTaskId, `preview ${plan.id}`);
    const modelTask = refine ? await createRefinedTask(plan, previewTask.id) : previewTask;

    const rigTask = await createRigTask(modelTask.id, plan.id);
    const outputUrl = skipAnimation
      ? rigTask.result?.rigged_character_glb_url
      : await animatedCharacterUrl(plan, rigTask);
    if (!outputUrl) {
      throw new Error(`Meshy ${plan.id} task did not return a downloadable GLB URL`);
    }

    await writeDownloadedAsset(plan.fileName, outputUrl);
  }
}

async function createRefinedTask(plan: CharacterPlan, previewTaskId: string): Promise<MeshyModelTask> {
  console.info(`[meshy] refining character ${plan.id}`);
  const refineTaskId = await createTask(textTo3dBaseUrl, {
    mode: 'refine',
    preview_task_id: previewTaskId,
    ai_model: 'meshy-6',
    target_formats: ['glb'],
    texture_prompt: plan.texturePrompt,
    enable_pbr: false,
    hd_texture: false,
    remove_lighting: true,
    moderation: true,
    auto_size: true,
    origin_at: 'bottom',
  });
  return waitForModelTask(refineTaskId, `refine ${plan.id}`);
}

async function createRigTask(inputTaskId: string, label: string): Promise<MeshyRigTask> {
  console.info(`[meshy] rigging ${label}`);
  const rigTaskId = await createTask(riggingBaseUrl, {
    input_task_id: inputTaskId,
    generate_basic_animations: true,
  });
  return waitForRigTask(rigTaskId, `rig ${label}`);
}

async function animatedCharacterUrl(plan: CharacterPlan, rigTask: MeshyRigTask): Promise<string | undefined> {
  if (plan.id === 'hero' && rigTask.result?.basic_animations?.walking_glb_url) {
    return rigTask.result.basic_animations.walking_glb_url;
  }

  console.info(`[meshy] animating ${plan.id} action=${plan.animationActionId}`);
  const animationTaskId = await createTask(animationBaseUrl, {
    rig_task_id: rigTask.id,
    action_id: plan.animationActionId,
    post_process: {
      operation_type: 'change_fps',
      fps: 30,
    },
  });
  const animationTask = await waitForAnimationTask(animationTaskId, `animate ${plan.id}`);
  return animationTask.result?.animation_glb_url ?? rigTask.result?.rigged_character_glb_url;
}

async function createTask(url: string, payload: Record<string, unknown>): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as MeshyCreateResponse;
  if (!response.ok || !body.result) {
    throw new Error(`Meshy create failed ${response.status}: ${body.message ?? JSON.stringify(body)}`);
  }
  return body.result;
}

async function waitForModelTask(taskId: string, label: string): Promise<MeshyModelTask> {
  return waitForTask(`${textTo3dBaseUrl}/${taskId}`, label) as Promise<MeshyModelTask>;
}

async function waitForRigTask(taskId: string, label: string): Promise<MeshyRigTask> {
  return waitForTask(`${riggingBaseUrl}/${taskId}`, label) as Promise<MeshyRigTask>;
}

async function waitForAnimationTask(taskId: string, label: string): Promise<MeshyAnimationTask> {
  return waitForTask(`${animationBaseUrl}/${taskId}`, label) as Promise<MeshyAnimationTask>;
}

async function waitForTask(url: string, label: string): Promise<MeshyModelTask | MeshyRigTask | MeshyAnimationTask> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20 * 60 * 1000) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const task = (await response.json()) as (MeshyModelTask | MeshyRigTask | MeshyAnimationTask) & { message?: string };
    if (!response.ok) {
      throw new Error(`Meshy retrieve failed ${response.status}: ${task.message ?? JSON.stringify(task)}`);
    }
    console.info(`[meshy] ${label} ${task.status} ${task.progress ?? 0}%`);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'EXPIRED' || task.status === 'CANCELED') {
      throw new Error(`Meshy ${label} failed: ${task.task_error?.message ?? task.status}`);
    }
    await delay(5000);
  }
  throw new Error(`Timed out waiting for Meshy ${label}`);
}

async function writeDownloadedAsset(fileName: string, url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  const assetBytes = Buffer.from(await response.arrayBuffer());
  if (assetBytes.byteLength > maxAssetBytes) {
    throw new Error(`${fileName} is ${assetBytes.byteLength} bytes, over budget ${maxAssetBytes} bytes`);
  }

  const filePath = join(outputDir, fileName);
  await writeFile(filePath, assetBytes);
  console.info(`[meshy] wrote ${filePath} ${assetBytes.byteLength} bytes`);
}

async function writeFallbackAssets(): Promise<void> {
  for (const plan of plans) {
    const group = plan.id === 'hero' ? createFallbackHero() : createFallbackSentry();
    const filePath = join(outputDir, plan.fileName);
    const bytes = await exportGlb(group);
    if (bytes.byteLength > maxAssetBytes) {
      throw new Error(`${plan.fileName} is ${bytes.byteLength} bytes, over budget ${maxAssetBytes} bytes`);
    }
    await writeFile(filePath, bytes);
    console.info(`[meshy:fallback] wrote ${filePath} ${bytes.byteLength} bytes`);
  }
}

async function exportGlb(object: THREE.Object3D): Promise<Buffer> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, {
    binary: true,
    onlyVisible: true,
    trs: false,
  });
  if (!(result instanceof ArrayBuffer)) {
    throw new Error('Expected binary GLB export');
  }
  return Buffer.from(result);
}

function createFallbackHero(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'meshy-fallback-hero';

  const suit = new THREE.MeshStandardMaterial({ color: '#216d78', emissive: '#0f3a43', roughness: 0.5, metalness: 0.18 });
  const accent = new THREE.MeshStandardMaterial({ color: '#7dfcc6', emissive: '#1d6b58', emissiveIntensity: 1.1, roughness: 0.34 });
  const visor = new THREE.MeshStandardMaterial({ color: '#5ad7ff', emissive: '#1d83a0', emissiveIntensity: 1.4, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0b1118', roughness: 0.64, metalness: 0.2 });

  addMesh(group, new THREE.CapsuleGeometry(0.23, 0.42, 4, 10), suit, [0, 0.62, 0], [0, 0, 0], [0.9, 1, 0.74], 'hero-body');
  addMesh(group, new THREE.SphereGeometry(0.19, 16, 10), suit, [0, 1.04, 0.02], [0, 0, 0], [0.92, 1.04, 0.84], 'hero-head');
  addMesh(group, new THREE.BoxGeometry(0.3, 0.07, 0.035), visor, [0, 1.06, 0.17], [0, 0, 0], [1, 1, 1], 'hero-visor');
  addMesh(group, new THREE.BoxGeometry(0.16, 0.24, 0.08), dark, [0, 0.68, -0.23], [0.1, 0, 0], [1, 1, 1], 'hero-pack');
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.46, 8), suit, [-0.27, 0.66, 0.03], [0.16, 0, -0.28], [1, 1, 1], 'hero-arm-l');
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.46, 8), suit, [0.27, 0.66, 0.03], [0.16, 0, 0.28], [1, 1, 1], 'hero-arm-r');
  addMesh(group, new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8), suit, [-0.1, 0.22, 0], [0.05, 0, 0.08], [1, 1, 1], 'hero-leg-l');
  addMesh(group, new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8), suit, [0.1, 0.22, 0], [-0.05, 0, -0.08], [1, 1, 1], 'hero-leg-r');
  addMesh(group, new THREE.BoxGeometry(0.42, 0.025, 0.03), accent, [0, 0.84, 0.19], [0, 0, 0], [1, 1, 1], 'hero-circuit-chest');
  addMesh(group, new THREE.BoxGeometry(0.035, 0.28, 0.035), accent, [0, 0.66, 0.2], [0, 0, 0], [1, 1, 1], 'hero-circuit-core');

  return group;
}

function createFallbackSentry(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'meshy-fallback-sentry';

  const armor = new THREE.MeshStandardMaterial({ color: '#a3303f', emissive: '#3b0e15', roughness: 0.5, metalness: 0.24 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.6, metalness: 0.35 });
  const amber = new THREE.MeshStandardMaterial({ color: '#ffcf5a', emissive: '#8a5008', emissiveIntensity: 1.5, roughness: 0.28 });
  const warning = new THREE.MeshStandardMaterial({ color: '#ff5964', emissive: '#7a1720', emissiveIntensity: 1.1, roughness: 0.32 });

  addMesh(group, new THREE.CylinderGeometry(0.28, 0.36, 0.55, 6), armor, [0, 0.62, 0], [0, Math.PI / 6, 0], [0.92, 1, 0.82], 'sentry-body');
  addMesh(group, new THREE.ConeGeometry(0.28, 0.32, 6), armor, [0, 0.99, 0.01], [0, Math.PI / 6, 0], [1, 0.8, 0.9], 'sentry-helmet');
  addMesh(group, new THREE.BoxGeometry(0.34, 0.08, 0.04), amber, [0, 0.93, 0.19], [0, 0, 0], [1, 1, 1], 'sentry-visor');
  addMesh(group, new THREE.BoxGeometry(0.5, 0.12, 0.16), dark, [0, 0.74, -0.08], [0, 0, 0], [1, 1, 1], 'sentry-core');
  addMesh(group, new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6), armor, [-0.34, 0.65, 0.02], [0.08, 0, -0.34], [1, 1, 1], 'sentry-arm-l');
  addMesh(group, new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6), armor, [0.34, 0.65, 0.02], [0.08, 0, 0.34], [1, 1, 1], 'sentry-arm-r');
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.08, 0.44, 6), armor, [-0.12, 0.22, 0], [0, 0, 0.07], [1, 1, 1], 'sentry-leg-l');
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.08, 0.44, 6), armor, [0.12, 0.22, 0], [0, 0, -0.07], [1, 1, 1], 'sentry-leg-r');
  addMesh(group, new THREE.SphereGeometry(0.055, 10, 6), warning, [0, 1.21, 0], [0, 0, 0], [1, 1, 1], 'sentry-beacon');
  addMesh(group, new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6), dark, [0, 1.12, -0.02], [0, 0, 0], [1, 1, 1], 'sentry-antenna');

  return group;
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
  name: string,
): void {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  group.add(mesh);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
