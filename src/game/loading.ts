import type { LoadingProgress } from './types';

export type LoadingTask = Readonly<{
  label: string;
  run: () => void | Promise<void>;
}>;

type LoadingSequenceOptions = Readonly<{
  tasks: readonly LoadingTask[];
  onProgress: (progress: LoadingProgress) => void;
  shouldCancel: () => boolean;
  minDurationMs?: number;
  minTaskMs?: number;
  readyDelayMs?: number;
}>;

const defaultMinDurationMs = 1800;
const defaultMinTaskMs = 260;
const defaultReadyDelayMs = 260;

export async function runLoadingSequence({
  tasks,
  onProgress,
  shouldCancel,
  minDurationMs = defaultMinDurationMs,
  minTaskMs = defaultMinTaskMs,
  readyDelayMs = defaultReadyDelayMs,
}: LoadingSequenceOptions): Promise<void> {
  const startedAt = performance.now();

  for (let index = 0; index < tasks.length; index += 1) {
    if (shouldCancel()) return;

    const task = tasks[index];
    onProgress({ value: index / tasks.length, label: task.label });
    await nextFrame();

    const taskStartedAt = performance.now();
    await task.run();
    const taskRemainingMs = minTaskMs - (performance.now() - taskStartedAt);
    if (taskRemainingMs > 0) {
      await delay(taskRemainingMs);
    }
    if (shouldCancel()) return;

    onProgress({ value: (index + 1) / tasks.length, label: task.label });
    await nextFrame();
  }

  const remainingMs = minDurationMs - (performance.now() - startedAt);
  if (remainingMs > 0) {
    await delay(remainingMs);
  }
  if (shouldCancel()) return;

  onProgress({ value: 1, label: 'Ready' });
  if (readyDelayMs > 0) {
    await delay(readyDelayMs);
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    requestAnimationFrame(finish);
    window.setTimeout(finish, 80);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
