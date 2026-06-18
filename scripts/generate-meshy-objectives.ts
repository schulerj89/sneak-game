import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

type MeshyCreateResponse = {
  result?: string;
  message?: string;
};

type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELED';

type MeshyTask = {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  model_urls?: {
    glb?: string;
    pre_remeshed_glb?: string;
  };
  thumbnail_url?: string;
  alpha_thumbnail_url?: string;
  thumbnail_urls?: {
    front?: string;
    right?: string;
    back?: string;
    left?: string;
  };
  task_error?: {
    message?: string;
  } | null;
  consumed_credits?: number;
};

type ObjectiveAssetPlan = Readonly<{
  id: 'keycard' | 'terminal';
  fileName: string;
  referencePath: string;
  targetPolycount: number;
  texturePrompt: string;
}>;

type ObjectiveAssetMetadata = Readonly<{
  id: ObjectiveAssetPlan['id'];
  generatedAt: string;
  pipeline: 'image-to-3d-texture-integrated-remesh';
  referencePath: string;
  outputPath: string;
  outputBytes: number;
  targetPolycount: number;
  imageTo3dTaskId: string;
  imageTo3dCredits?: number;
  texturePrompt: string;
}>;

const imageTo3dBaseUrl = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || process.env.MESHY_DRY_RUN === 'true';
const maxAssetBytes = Number(process.env.MESHY_MAX_ASSET_BYTES ?? 18_000_000);
const outputDir = 'src/assets/objectives';
const referenceDir = join(outputDir, 'reference');
const metadataDir = 'tools/meshy/generated/objectives';
const previewOutputDir = 'docs/2026-06-18-meshy-objective-upgrade/previews';

const plans: readonly ObjectiveAssetPlan[] = [
  {
    id: 'keycard',
    fileName: 'keycard-cinematic.glb',
    referencePath: join(referenceDir, 'ultra-keycard-reference.png'),
    targetPolycount: 12_000,
    texturePrompt:
      'Preserve the black graphite access card, gold beveled rim, raised contact chip, screws, seams, and glowing yellow circuit traces. No letters, no logo, no symbols that read as text. Keep it compact and game-ready.',
  },
  {
    id: 'terminal',
    fileName: 'terminal-cinematic.glb',
    referencePath: join(referenceDir, 'ultra-terminal-reference.png'),
    targetPolycount: 16_000,
    texturePrompt:
      'Preserve the compact graphite terminal body, raised cyan glass screen, side brackets, bottom keypad, screws, seams, vents, and glowing blue trim. No letters, no logo. Keep it readable from an isometric stealth game camera.',
  },
];

await mkdir(outputDir, { recursive: true });
await mkdir(metadataDir, { recursive: true });
await mkdir(previewOutputDir, { recursive: true });

if (dryRun) {
  await verifyReferenceInputs();
} else {
  const apiKey = await resolveApiKey();
  await writeMeshyAssets(apiKey);
}

async function writeMeshyAssets(apiKey: string): Promise<void> {
  for (const plan of plans) {
    console.info(`[meshy] creating image-to-3d objective ${plan.id} from ${basename(plan.referencePath)}`);
    const imageDataUri = await readImageDataUri(plan.referencePath);
    const modelTaskId = await createTask(apiKey, imageTo3dBaseUrl, {
      image_url: imageDataUri,
      ai_model: 'meshy-6',
      model_type: 'standard',
      should_texture: true,
      texture_prompt: plan.texturePrompt,
      enable_pbr: true,
      hd_texture: false,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: plan.targetPolycount,
      save_pre_remeshed_model: false,
      remove_lighting: true,
      image_enhancement: false,
      moderation: true,
      target_formats: ['glb'],
      alpha_thumbnail: true,
      multi_view_thumbnails: true,
      auto_size: true,
      origin_at: 'bottom',
    });
    console.info(`[meshy] ${plan.id} image-to-3d task ${modelTaskId}`);
    const modelTask = await waitForTask(apiKey, `${imageTo3dBaseUrl}/${modelTaskId}`, `image-to-3d ${plan.id}`);
    await writeTaskPreviews(plan, modelTask, 'final');

    const glbUrl = modelTask.model_urls?.glb;
    if (!glbUrl) {
      throw new Error(`Meshy ${plan.id} task did not return a downloadable GLB URL`);
    }

    const outputPath = join(outputDir, plan.fileName);
    const outputBytes = await writeDownloadedFile(outputPath, glbUrl, plan.fileName);
    await writeMetadata({
      id: plan.id,
      generatedAt: new Date().toISOString(),
      pipeline: 'image-to-3d-texture-integrated-remesh',
      referencePath: plan.referencePath,
      outputPath,
      outputBytes,
      targetPolycount: plan.targetPolycount,
      imageTo3dTaskId: modelTask.id,
      imageTo3dCredits: modelTask.consumed_credits,
      texturePrompt: plan.texturePrompt,
    });
  }
}

async function verifyReferenceInputs(): Promise<void> {
  for (const plan of plans) {
    const bytes = await readFile(plan.referencePath);
    if (bytes.byteLength < 10_000) {
      throw new Error(`${plan.referencePath} is too small to be a useful reference image`);
    }
    console.info(`[meshy:dry-run] verified ${plan.referencePath} ${bytes.byteLength} bytes`);
  }
}

async function resolveApiKey(): Promise<string> {
  const envKey = process.env.MESHY_API_KEY?.trim();
  if (envKey) return envKey;

  const apiKeyFile = process.env.MESHY_API_KEY_FILE ?? 'C:/Users/joshs/Projects/meshy-api-key.txt';
  try {
    const fileKey = (await readFile(apiKeyFile, 'utf8')).trim();
    if (fileKey) return fileKey;
  } catch {
    // Keep the key lookup quiet so missing local files do not leak path details into logs.
  }

  throw new Error('Set MESHY_API_KEY or MESHY_API_KEY_FILE before running npm run assets:meshy-objectives.');
}

async function createTask(apiKey: string, url: string, payload: Record<string, unknown>): Promise<string> {
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

async function waitForTask(apiKey: string, url: string, label: string): Promise<MeshyTask> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25 * 60 * 1000) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const task = (await response.json()) as MeshyTask & { message?: string };
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

async function readImageDataUri(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

async function writeTaskPreviews(plan: ObjectiveAssetPlan, task: MeshyTask, phase: 'final'): Promise<void> {
  const previews = [
    ['front', task.thumbnail_urls?.front ?? task.thumbnail_url],
    ['right', task.thumbnail_urls?.right],
    ['alpha', task.alpha_thumbnail_url],
  ] as const;

  for (const [view, url] of previews) {
    if (!url) continue;
    await writeDownloadedFile(join(previewOutputDir, `${plan.id}-${phase}-${view}.png`), url, `${plan.id} ${phase} ${view}`);
  }
}

async function writeDownloadedFile(filePath: string, url: string, label: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }

  const assetBytes = Buffer.from(await response.arrayBuffer());
  if (filePath.endsWith('.glb') && assetBytes.byteLength > maxAssetBytes) {
    throw new Error(`${label} is ${assetBytes.byteLength} bytes, over budget ${maxAssetBytes} bytes`);
  }

  await writeFile(filePath, assetBytes);
  console.info(`[meshy] wrote ${filePath} ${assetBytes.byteLength} bytes`);
  return assetBytes.byteLength;
}

async function writeMetadata(metadata: ObjectiveAssetMetadata): Promise<void> {
  const filePath = join(metadataDir, `${metadata.id}.json`);
  await writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.info(`[meshy] wrote ${filePath}`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
