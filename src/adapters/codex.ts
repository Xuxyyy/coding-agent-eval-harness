import {runProcess, type ProcessResult} from '../environments/process.js';
import type {
  AdapterResult,
  AdapterTerminalStatus,
  CanonicalEvent,
  Usage,
} from '../types/index.js';
import {compactUsage, executableVersion, finiteNumber, jsonLines, processFailure} from './shared.js';
import type {AdapterInvocation, AgentAdapter} from './types.js';

export function codexArguments(invocation: AdapterInvocation): string[] {
  return [
    '--ask-for-approval',
    'never',
    '--sandbox',
    'workspace-write',
    '--cd',
    invocation.cwd,
    ...(invocation.model === undefined ? [] : ['--model', invocation.model]),
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--json',
    invocation.prompt,
  ];
}

function codexUsage(value: unknown): Usage | null {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const usage: Usage = {};
  const input = finiteNumber(source.input_tokens);
  const cached = finiteNumber(source.cached_input_tokens);
  const output = finiteNumber(source.output_tokens);
  const total = finiteNumber(source.total_tokens);
  if (input !== undefined) usage.inputTokens = input;
  if (cached !== undefined) usage.cachedInputTokens = cached;
  if (output !== undefined) usage.outputTokens = output;
  if (total !== undefined) usage.totalTokens = total;
  else if (input !== undefined && output !== undefined) usage.totalTokens = input + output;
  return compactUsage(usage);
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function itemRecord(event: Record<string, unknown>): Record<string, unknown> | null {
  return typeof event.item === 'object' && event.item !== null && !Array.isArray(event.item)
    ? (event.item as Record<string, unknown>)
    : null;
}

type UnsequencedEvent<T extends CanonicalEvent = CanonicalEvent> = T extends CanonicalEvent
  ? Omit<T, 'sequence'>
  : never;

function codexEvents(
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
    const type = typeof event.type === 'string' ? event.type : 'unknown';
    if (type === 'turn.completed' || type === 'turn.failed' || type === 'error') continue;
    const item = itemRecord(event);
    const itemType = textField(item?.type);
    if (itemType !== null && /reasoning|thought/iu.test(itemType)) continue;
    if (type === 'item.completed' && itemType === 'agent_message' && typeof item?.text === 'string') {
      push({kind: 'assistant_message', providerEventType: type, text: item.text});
    } else if (
      type === 'item.started' &&
      itemType !== null &&
      ['command_execution', 'mcp_tool_call', 'tool_call', 'web_search'].includes(itemType)
    ) {
      push({
        kind: 'tool_call',
        providerEventType: type,
        toolName: textField(item?.name ?? itemType),
        toolCallId: textField(item?.id),
      });
    } else if (
      type === 'item.completed' &&
      itemType !== null &&
      ['command_execution', 'mcp_tool_call', 'tool_call', 'web_search'].includes(itemType)
    ) {
      push({
        kind: 'tool_result',
        providerEventType: type,
        toolName: textField(item?.name ?? itemType),
        toolCallId: textField(item?.id),
        status: textField(item?.status),
      });
    } else {
      push({kind: 'other', providerEventType: type});
    }
  }
  const terminalProviderEventType = [...raw]
    .reverse()
    .map((event) => event.type)
    .find((type) => type === 'turn.completed' || type === 'turn.failed' || type === 'error');
  const terminalType = typeof terminalProviderEventType === 'string'
    ? terminalProviderEventType
    : 'process';
  if (usage !== null) push({kind: 'usage', providerEventType: terminalType, usage});
  push({kind: 'terminal', providerEventType: terminalType, status, message: terminalMessage});
  return events;
}

function failureEvents(status: AdapterTerminalStatus, message: string | null): CanonicalEvent[] {
  return [{sequence: 1, kind: 'terminal', providerEventType: 'process', status, message}];
}

export function parseCodex(run: ProcessResult): AdapterResult {
  const base = {
    elapsedMs: run.elapsedMs,
    exitCode: run.exitCode,
    signal: run.signal,
    stdout: run.stdout,
    stderr: run.stderr,
    stdoutBytes: run.stdoutBytes,
    stderrBytes: run.stderrBytes,
    truncated: run.truncated,
    cleanup: {adapterHome: true, process: run.cleanupComplete},
    publicSessionId: null as string | null,
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
  let finalMessage: string | null = null;
  let terminal: Record<string, unknown> | undefined;
  let publicSessionId: string | null = null;
  for (const event of events) {
    if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
      publicSessionId = event.thread_id;
    }
    if (event.type === 'item.completed') {
      const item = event.item;
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        if (record.type === 'agent_message' && typeof record.text === 'string') {
          finalMessage = record.text;
        }
      }
    }
    if (event.type === 'turn.completed' || event.type === 'turn.failed' || event.type === 'error') {
      terminal = event;
    }
  }
  if (terminal === undefined) {
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage,
      usage: null,
      publicSessionId,
      events: codexEvents(events, 'error', null, 'Codex stream has no authoritative terminal event'),
      error: 'Codex stream has no authoritative terminal event',
    };
  }
  if (terminal.type === 'turn.completed' && run.exitCode === 0) {
    const usage = codexUsage(terminal.usage);
    return {
      ...base,
      terminalStatus: 'completed',
      finalMessage,
      usage,
      publicSessionId,
      events: codexEvents(events, 'completed', usage, null),
    };
  }
  if (terminal.type === 'turn.failed') {
    const error = terminal.error;
    const detail =
      typeof error === 'object' && error !== null && !Array.isArray(error)
        ? (error as Record<string, unknown>).message
        : undefined;
    return {
      ...base,
      terminalStatus: 'failed',
      finalMessage,
      usage: null,
      publicSessionId,
      events: codexEvents(
        events,
        'failed',
        null,
        typeof detail === 'string' ? detail : null,
      ),
      ...(typeof detail === 'string' ? {error: detail} : {}),
    };
  }
  const message = typeof terminal.message === 'string' ? terminal.message : undefined;
  const error =
    message ??
    (terminal.type === 'turn.completed'
      ? `Codex reported completion but exited ${run.exitCode}`
      : 'Codex reported a terminal error');
  return {
    ...base,
    terminalStatus: 'error',
    finalMessage,
    usage: null,
    publicSessionId,
    events: codexEvents(events, 'error', null, error),
    error,
  };
}

export const codexAdapter: AgentAdapter = {
  id: 'codex',
  version: executableVersion,
  async run(invocation) {
    const run = await runProcess({
      command: invocation.command,
      args: codexArguments(invocation),
      cwd: invocation.cwd,
      env: {
        ...invocation.env,
        ...(process.env.CODEX_HOME === undefined ? {CODEX_HOME: undefined} : {CODEX_HOME: process.env.CODEX_HOME}),
      },
      timeoutMs: invocation.maxSeconds * 1_000,
    });
    return parseCodex(run);
  },
};
