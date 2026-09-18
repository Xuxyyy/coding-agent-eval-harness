import type {ProcessResult} from '../environments/process.js';
import {runProcess} from '../environments/process.js';
import type {Usage} from '../types/index.js';

export function jsonLines(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`malformed JSONL at line ${index + 1}: ${(error as Error).message}`);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`malformed JSONL at line ${index + 1}: event must be an object`);
    }
    records.push(value as Record<string, unknown>);
  }
  return records;
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function compactUsage(usage: Usage): Usage | null {
  return Object.keys(usage).length === 0 ? null : usage;
}

export async function executableVersion(command: string, cwd: string): Promise<string> {
  const run = await runProcess({
    command,
    args: ['--version'],
    cwd,
    timeoutMs: 10_000,
    outputLimitBytes: 16_384,
  });
  if (
    run.error !== undefined ||
    run.exitCode !== 0 ||
    run.timedOut ||
    run.truncated.stdout ||
    !run.cleanupComplete
  ) {
    throw new Error(
      `could not read executable version: ${run.error ?? (run.stderr.trim() || `exit ${run.exitCode}`)}`,
    );
  }
  const version = run.stdout.trim();
  if (version === '') throw new Error('executable --version returned no text');
  return version;
}

export function processFailure(run: ProcessResult): string | undefined {
  if (run.error !== undefined) return `launch failed: ${run.error}`;
  if (!run.cleanupComplete) return 'process-group cleanup could not be confirmed';
  if (run.truncated.stdout) return 'agent stdout exceeded the capture limit';
  return undefined;
}
