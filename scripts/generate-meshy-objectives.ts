import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type MeshyCreateResponse = {
  result?: string;
  message?: string;
};

type MeshyTask = {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress?: number;
  model_urls?: {
    glb?: string;
  };
  task_error?: {
    message?: string;
  };
};

type ObjectiveAssetPlan = Readonly<{
  id: 'keycard' | 'terminal';
  fileName: string;
  targetPolycount: number;
  prompt: string;
  texturePrompt: string;
}>;

const apiBaseUrl = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const dummyApiKey = 'msy_dummy_api_key_for_test_mode_12345678';
const args = new Set(process.argv.slice(2));
const testMode = args.has('--test-mode') || process.env.MESHY_TEST_MODE === 'true' || process.env.npm_config_test_mode === 'true';
const refine = args.has('--refine');
const apiKey = process.env.MESHY_API_KEY || (testMode ? dummyApiKey : '');
const usingDummyKey = apiKey === dummyApiKey;
const maxAssetBytes = Number(process.env.MESHY_MAX_ASSET_BYTES ?? 250_000);
const outputDir = testMode && !args.has('--write-assets') ? 'artifacts/meshy-test-objectives' : 'src/assets/objectives';

const plans: readonly ObjectiveAssetPlan[] = [
  {
    id: 'keycard',
    fileName: 'keycard-cinematic.glb',
    targetPolycount: 900,
    prompt:
      'low-poly cyberpunk access keycard game collectible, flat beveled smart card, raised contact chip, glowing circuit traces, rectangular prop, isolated, no hands, no text',
    texturePrompt:
      'yellow and black cyberpunk access card, clean emissive circuit lines, small metallic chip, readable game prop, no letters or logos',
  },
  {
    id: 'terminal',
    fileName: 'terminal-cinematic.glb',
    targetPolycount: 1300,
    prompt:
      'low-poly cyberpunk terminal pickup game collectible, compact blue data pad, raised glowing screen, buttons, beveled hard-surface prop, isolated, no hands, no text',
    texturePrompt:
      'blue cyberpunk terminal console, glowing cyan screen, dark metal bevels, compact readable game prop, no letters or logos',
  },
];

if (!apiKey) {
  throw new Error('Set MESHY_API_KEY before running npm run assets:meshy-objectives. Use --test-mode only to verify Meshy API plumbing.');
}

if (usingDummyKey && !testMode) {
  throw new Error('The configured Meshy dummy key is test-mode only. Set a real MESHY_API_KEY to generate game assets.');
}

await mkdir(outputDir, { recursive: true });

for (const plan of plans) {
  console.info(`[meshy] creating preview ${plan.id}`);
  const previewTaskId = await createTask({
    mode: 'preview',
    prompt: plan.prompt,
    ai_model: 'meshy-6',
    should_remesh: true,
    topology: 'triangle',
    target_polycount: plan.targetPolycount,
    target_formats: ['glb'],
    moderation: true,
    auto_size: true,
    origin_at: 'bottom',
  });
  const previewTask = await waitForTask(previewTaskId, `preview ${plan.id}`);

  const outputTask = refine
    ? await createRefinedTask(plan, previewTask.id)
    : previewTask;

  if (!outputTask.model_urls?.glb) {
    throw new Error(`Meshy task ${outputTask.id} did not return a GLB URL`);
  }

  const assetBytes = await download(outputTask.model_urls.glb);
  if (assetBytes.byteLength > maxAssetBytes) {
    if (testMode) {
      console.warn(`[meshy] ${plan.fileName} is ${assetBytes.byteLength} bytes, over budget ${maxAssetBytes} bytes; skipping write in test mode`);
      continue;
    }
    throw new Error(`${plan.fileName} is ${assetBytes.byteLength} bytes, over budget ${maxAssetBytes} bytes`);
  }

  const filePath = join(outputDir, plan.fileName);
  await writeFile(filePath, assetBytes);
  console.info(`[meshy] wrote ${filePath} ${assetBytes.byteLength} bytes`);
}

async function createRefinedTask(plan: ObjectiveAssetPlan, previewTaskId: string): Promise<MeshyTask> {
  console.info(`[meshy] creating refine ${plan.id}`);
  const refineTaskId = await createTask({
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
  return waitForTask(refineTaskId, `refine ${plan.id}`);
}

async function createTask(payload: Record<string, unknown>): Promise<string> {
  const response = await fetch(apiBaseUrl, {
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

async function waitForTask(taskId: string, label: string): Promise<MeshyTask> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15 * 60 * 1000) {
    const task = await getTask(taskId);
    console.info(`[meshy] ${label} ${task.status} ${task.progress ?? 0}%`);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'EXPIRED') {
      throw new Error(`Meshy ${label} failed: ${task.task_error?.message ?? task.status}`);
    }
    await delay(5000);
  }
  throw new Error(`Timed out waiting for Meshy ${label}`);
}

async function getTask(taskId: string): Promise<MeshyTask> {
  const response = await fetch(`${apiBaseUrl}/${taskId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const body = (await response.json()) as MeshyTask & { message?: string };
  if (!response.ok) {
    throw new Error(`Meshy retrieve failed ${response.status}: ${body.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
