import {spawn} from 'node:child_process';

export const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
export const DEFAULT_KILL_GRACE_MS = 500;

export type ProcessRequest = {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputLimitBytes?: number;
  killGraceMs?: number;
};

export type ProcessResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutBytes: Uint8Array;
  stderrBytes: Uint8Array;
  truncated: {stdout: boolean; stderr: boolean};
  timedOut: boolean;
  elapsedMs: number;
  cleanupComplete: boolean;
  error?: string;
};

type Bounded = {chunks: Buffer[]; bytes: number; truncated: boolean};

function append(target: Bounded, chunk: Buffer, limit: number): void {
  if (target.bytes >= limit) {
    target.truncated = true;
    return;
  }
  const remaining = limit - target.bytes;
  const kept = chunk.subarray(0, remaining);
  target.chunks.push(kept);
  target.bytes += kept.length;
  if (kept.length < chunk.length) target.truncated = true;
}

function groupExists(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

async function finishGroup(pid: number, graceMs: number): Promise<boolean> {
  if (!groupExists(pid)) return true;
  signalGroup(pid, 'SIGTERM');
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (!groupExists(pid)) return true;
  }
  signalGroup(pid, 'SIGKILL');
  const killDeadline = Date.now() + Math.max(200, graceMs);
  while (Date.now() < killDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (!groupExists(pid)) return true;
  }
  return !groupExists(pid);
}

export async function runProcess(request: ProcessRequest): Promise<ProcessResult> {
  if (process.platform === 'win32') {
    throw new Error('agent-eval process execution supports macOS and Linux only');
  }
  if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) {
    throw new Error('process timeout must be positive');
  }
  const started = Date.now();
  const limit = request.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT;
  const grace = request.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const stdout: Bounded = {chunks: [], bytes: 0, truncated: false};
  const stderr: Bounded = {chunks: [], bytes: 0, truncated: false};

  return await new Promise<ProcessResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let launchError: Error | undefined;
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: {...process.env, ...request.env},
      detached: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk: Buffer) => append(stdout, chunk, limit));
    child.stderr.on('data', (chunk: Buffer) => append(stderr, chunk, limit));
    child.on('error', (error) => {
      launchError = error;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) signalGroup(child.pid, 'SIGTERM');
      setTimeout(() => {
        if (child.pid !== undefined && groupExists(child.pid)) {
          signalGroup(child.pid, 'SIGKILL');
        }
      }, grace).unref();
    }, request.timeoutMs);

    child.on('close', async (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const cleanupComplete =
        child.pid === undefined ? true : await finishGroup(child.pid, grace);
      const stdoutBuffer = Buffer.concat(stdout.chunks);
      const stderrBuffer = Buffer.concat(stderr.chunks);
      resolve({
        exitCode,
        signal,
        stdout: stdoutBuffer.toString('utf8'),
        stderr: stderrBuffer.toString('utf8'),
        stdoutBytes: stdoutBuffer,
        stderrBytes: stderrBuffer,
        truncated: {stdout: stdout.truncated, stderr: stderr.truncated},
        timedOut,
        elapsedMs: Date.now() - started,
        cleanupComplete,
        ...(launchError === undefined ? {} : {error: launchError.message}),
      });
    });
  });
}
