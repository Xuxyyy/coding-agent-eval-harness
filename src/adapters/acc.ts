import {existsSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runProcess, type ProcessResult} from '../environments/process.js';
import type {
  AdapterResult,
  AdapterTerminalStatus,
  CanonicalEvent,
  Usage,
} from '../types/index.js';
import {
  compactUsage,
  executableVersion,
  finiteNumber,
  jsonLines,
  processFailure,
} from './shared.js';
import type {AdapterInvocation, AgentAdapter} from './types.js';

export const ACC_HOME_PREFIX = 'agent-eval-acc-home-';

export function accArguments(invocation: AdapterInvocation): string[] {
  return [
    '-p',
    invocation.prompt,
    '--json',
    '--yes',
    '--max-seconds',
    String(invocation.maxSeconds),
  ];
}

function usageOf(value: unknown, terminal: Record<string, unknown>): Usage | null {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const usage: Usage = {};
  const input = finiteNumber(source.prompt);
  const output = finiteNumber(source.completion);
  const total = finiteNumber(source.total);
  const prompts = finiteNumber(terminal.prompts);
  const steps = finiteNumber(terminal.steps);
  if (input !== undefined) usage.inputTokens = input;
  if (output !== undefined) usage.outputTokens = output;
  if (total !== undefined) usage.totalTokens = total;
  if (prompts !== undefined) usage.prompts = prompts;
  if (steps !== undefined) usage.steps = steps;
  return compactUsage(usage);
}

function providerType(event: Record<string, unknown>): string {
  if (typeof event.type === 'string') return event.type;
  if (typeof event.kind === 'string') return event.kind;
  return 'unknown';
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type UnsequencedEvent<T extends CanonicalEvent = CanonicalEvent> = T extends CanonicalEvent
  ? Omit<T, 'sequence'>
  : never;

function accEvents(
  raw: readonly Record<string, unknown>[],
  status: AdapterTerminalStatus,
  usage: Usage | null,
  terminalMessage: string | null,
): CanonicalEvent[] {
  const events: CanonicalEvent[] = [];
  const push = (event: UnsequencedEvent): void => {
    events.push({...event, sequence: events.length + 1} as CanonicalEvent);
  };
  for (const event of raw) {
    const type = providerType(event);
    if (event.kind === 'result') continue;
    if (/reasoning|thought/iu.test(type)) continue;
    if (type === 'text_delta' && typeof event.text === 'string') {
      push({kind: 'assistant_message', providerEventType: type, text: event.text});
    } else if (type === 'tool_use' || type === 'tool_call') {
      push({
        kind: 'tool_call',
        providerEventType: type,
        toolName: textField(event.name ?? event.tool),
        toolCallId: textField(event.id ?? event.tool_call_id),
      });
    } else if (type === 'tool_result') {
      push({
        kind: 'tool_result',
        providerEventType: type,
        toolName: textField(event.name ?? event.tool),
        toolCallId: textField(event.id ?? event.tool_call_id),
        status: textField(event.status),
      });
    } else {
      push({kind: 'other', providerEventType: type});
    }
  }
  if (usage !== null) push({kind: 'usage', providerEventType: 'result', usage});
  push({kind: 'terminal', providerEventType: 'result', status, message: terminalMessage});
  return events;
}

function failureEvents(status: AdapterTerminalStatus, message: string | null): CanonicalEvent[] {
  return [{sequence: 1, kind: 'terminal', providerEventType: 'process', status, message}];
}

export function parseAcc(run: ProcessResult, adapterHome: boolean): AdapterResult {
  const base = {
    elapsedMs: run.elapsedMs,
    exitCode: run.exitCode,
    signal: run.signal,
    stdout: run.stdout,
    stderr: run.stderr,
    stdoutBytes: run.stdoutBytes,
    stderrBytes: run.stderrBytes,
    truncated: run.truncated,
    cleanup: {adapterHome, process: run.cleanupComplete},
    publicSessionId: null,
  };
  const failed = processFailure(run);
  if (failed !== undefined) {
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: failureEvents('error', failed),
      error: failed,
    };
  }
  if (run.timedOut) {
    return {
      ...base,
      terminalStatus: 'timeout',
      finalMessage: null,
      usage: null,
      events: failureEvents('timeout', null),
    };
  }
  let events: Record<string, unknown>[];
  try {
    events = jsonLines(run.stdout);
  } catch (error) {
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: failureEvents('error', (error as Error).message),
      error: (error as Error).message,
    };
  }
  const terminal = events.at(-1);
  if (terminal?.kind !== 'result') {
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: accEvents(events, 'error', null, 'ACC stream has no authoritative final result event'),
      error: 'ACC stream has no authoritative final result event',
    };
  }
  if (terminal.schemaVersion !== undefined && terminal.schemaVersion !== 1) {
    const error = `unsupported ACC result schema version: ${String(terminal.schemaVersion)}`;
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: accEvents(events, 'error', null, error),
      error,
    };
  }
  const streamedMessage =
    events
      .filter((event) => event.type === 'text_delta' && typeof event.text === 'string')
      .map((event) => event.text as string)
      .join('') || null;
  const finalMessage =
    typeof terminal.message === 'string' ? terminal.message : streamedMessage;
  const usage = usageOf(terminal.usage, terminal);
  const stopped = terminal.stopped;
  if (stopped === 'done' && run.exitCode === 0) {
    return {
      ...base,
      terminalStatus: 'completed',
      finalMessage,
      usage,
      events: accEvents(events, 'completed', usage, null),
    };
  }
  if (stopped === 'denied') {
    return {
      ...base,
      terminalStatus: 'denied',
      finalMessage,
      usage,
      events: accEvents(events, 'denied', usage, null),
    };
  }
  if (stopped === 'timeout') {
    return {
      ...base,
      terminalStatus: 'timeout',
      finalMessage,
      usage,
      events: accEvents(events, 'timeout', usage, null),
    };
  }
  const detail = typeof terminal.error === 'string' ? terminal.error : undefined;
  const error =
    detail ??
    (stopped === 'done'
      ? `ACC reported done but exited ${run.exitCode}`
      : `unknown or failed ACC terminal state: ${String(stopped)}`);
  return {
    ...base,
    terminalStatus: 'error',
    finalMessage,
    usage,
    events: accEvents(events, 'error', usage, error),
    error,
  };
}

export const accAdapter: AgentAdapter = {
  id: 'acc',
  version: executableVersion,
  async run(invocation) {
    const home = mkdtempSync(join(tmpdir(), ACC_HOME_PREFIX));
    let run: ProcessResult;
    let adapterHome = false;
    try {
      const settings = {
        permission_mode: 'auto-edits',
        ...(invocation.model === undefined ? {} : {model: invocation.model}),
      };
      writeFileSync(join(home, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
      run = await runProcess({
        command: invocation.command,
        args: accArguments(invocation),
        cwd: invocation.cwd,
        env: {...invocation.env, ACC_HOME: home},
        timeoutMs: (invocation.maxSeconds + 5) * 1_000,
      });
    } finally {
      rmSync(home, {recursive: true, force: true});
      adapterHome = !existsSync(home);
    }
    return parseAcc(run!, adapterHome);
  },
};
