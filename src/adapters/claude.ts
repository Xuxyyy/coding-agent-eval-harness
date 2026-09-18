import {runProcess, type ProcessResult} from '../environments/process.js';
import type {
  AdapterResult,
  AdapterTerminalStatus,
  CanonicalEvent,
  Usage,
} from '../types/index.js';
import {compactUsage, executableVersion, finiteNumber, jsonLines, processFailure} from './shared.js';
import type {AdapterInvocation, AgentAdapter} from './types.js';

export function claudeArguments(invocation: AdapterInvocation): string[] {
  return [
    '-p',
    invocation.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--no-session-persistence',
    '--safe-mode',
    ...(invocation.model === undefined ? [] : ['--model', invocation.model]),
  ];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function contentBlocks(event: Record<string, unknown>): Record<string, unknown>[] {
  const message = record(event.message);
  if (!Array.isArray(message?.content)) return [];
  return message.content.flatMap((block) => {
    const value = record(block);
    return value === null ? [] : [value];
  });
}

function claudeUsage(value: unknown): Usage | null {
  const source = record(value) ?? {};
  const usage: Usage = {};
  const input = finiteNumber(source.input_tokens);
  const cached = finiteNumber(source.cache_read_input_tokens);
  const output = finiteNumber(source.output_tokens);
  if (input !== undefined) usage.inputTokens = input;
  if (cached !== undefined) usage.cachedInputTokens = cached;
  if (output !== undefined) usage.outputTokens = output;
  if (input !== undefined && output !== undefined) usage.totalTokens = input + output;
  return compactUsage(usage);
}

type UnsequencedEvent<T extends CanonicalEvent = CanonicalEvent> = T extends CanonicalEvent
  ? Omit<T, 'sequence'>
  : never;

function claudeEvents(
  raw: readonly Record<string, unknown>[],
  status: AdapterTerminalStatus,
  usage: Usage | null,
  terminalMessage: string | null,
): CanonicalEvent[] {
  const events: CanonicalEvent[] = [];
  const toolNames = new Map<string, string>();
  const push = (event: UnsequencedEvent): void => {
    events.push({...event, sequence: events.length + 1} as CanonicalEvent);
  };

  for (const event of raw) {
    const type = textField(event.type) ?? 'unknown';
    if (type === 'result') continue;
    if (type === 'assistant') {
      const blocks = contentBlocks(event);
      let emitted = false;
      let privateOnly = blocks.length > 0;
      for (const block of blocks) {
        const blockType = textField(block.type) ?? 'unknown';
        if (/thinking|reasoning/iu.test(blockType)) continue;
        privateOnly = false;
        if (blockType === 'text' && typeof block.text === 'string') {
          push({kind: 'assistant_message', providerEventType: type, text: block.text});
        } else if (blockType === 'tool_use' || blockType === 'server_tool_use') {
          const toolCallId = textField(block.id);
          const toolName = textField(block.name);
          if (toolCallId !== null && toolName !== null) toolNames.set(toolCallId, toolName);
          push({kind: 'tool_call', providerEventType: type, toolName, toolCallId});
        } else {
          push({kind: 'other', providerEventType: type});
        }
        emitted = true;
      }
      if (!emitted && !privateOnly) push({kind: 'other', providerEventType: type});
      continue;
    }
    if (type === 'user') {
      const blocks = contentBlocks(event);
      let emitted = false;
      for (const block of blocks) {
        if (block.type !== 'tool_result') continue;
        const toolCallId = textField(block.tool_use_id);
        push({
          kind: 'tool_result',
          providerEventType: type,
          toolName: toolCallId === null ? null : (toolNames.get(toolCallId) ?? null),
          toolCallId,
          status: block.is_error === true ? 'error' : 'completed',
        });
        emitted = true;
      }
      if (!emitted) push({kind: 'other', providerEventType: type});
      continue;
    }
    push({kind: 'other', providerEventType: type});
  }

  if (usage !== null) push({kind: 'usage', providerEventType: 'result', usage});
  push({kind: 'terminal', providerEventType: 'result', status, message: terminalMessage});
  return events;
}

function failureEvents(status: AdapterTerminalStatus, message: string | null): CanonicalEvent[] {
  return [{sequence: 1, kind: 'terminal', providerEventType: 'process', status, message}];
}

function resultError(terminal: Record<string, unknown>): string {
  if (Array.isArray(terminal.errors)) {
    const errors = terminal.errors.filter((value): value is string => typeof value === 'string');
    if (errors.length > 0) return errors.join('; ');
  }
  if (typeof terminal.result === 'string' && terminal.result.length > 0) return terminal.result;
  return `Claude Code reported ${String(terminal.subtype ?? 'an unknown terminal error')}`;
}

export function parseClaude(run: ProcessResult): AdapterResult {
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
  };
  const failed = processFailure(run);
  if (failed !== undefined) {
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: failureEvents('error', failed),
      publicSessionId: null,
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
      publicSessionId: null,
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
      publicSessionId: null,
      error: (error as Error).message,
    };
  }

  let terminal: Record<string, unknown> | undefined;
  let publicSessionId: string | null = null;
  for (const event of events) {
    if (typeof event.session_id === 'string') publicSessionId = event.session_id;
    if (event.type === 'result') terminal = event;
  }
  if (terminal === undefined) {
    const error = 'Claude Code stream has no authoritative terminal result event';
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage: null,
      usage: null,
      events: claudeEvents(events, 'error', null, error),
      publicSessionId,
      error,
    };
  }

  const finalMessage = typeof terminal.result === 'string' ? terminal.result : null;
  const usage = claudeUsage(terminal.usage);
  if (terminal.subtype === 'success' && terminal.is_error !== true && run.exitCode === 0) {
    return {
      ...base,
      terminalStatus: 'completed',
      finalMessage,
      usage,
      events: claudeEvents(events, 'completed', usage, null),
      publicSessionId,
    };
  }
  if (terminal.subtype === 'success' && terminal.is_error !== true) {
    const error = `Claude Code reported success but exited ${run.exitCode}`;
    return {
      ...base,
      terminalStatus: 'error',
      finalMessage,
      usage,
      events: claudeEvents(events, 'error', usage, error),
      publicSessionId,
      error,
    };
  }
  if (
    terminal.is_error === true ||
    (typeof terminal.subtype === 'string' && terminal.subtype.startsWith('error_'))
  ) {
    const error = resultError(terminal);
    return {
      ...base,
      terminalStatus: 'failed',
      finalMessage,
      usage,
      events: claudeEvents(events, 'failed', usage, error),
      publicSessionId,
      error,
    };
  }

  const error = `Claude Code reported an unknown terminal result: ${String(terminal.subtype)}`;
  return {
    ...base,
    terminalStatus: 'error',
    finalMessage,
    usage,
    events: claudeEvents(events, 'error', usage, error),
    publicSessionId,
    error,
  };
}

export const claudeAdapter: AgentAdapter = {
  id: 'claude',
  version: executableVersion,
  async run(invocation) {
    const run = await runProcess({
      command: invocation.command,
      args: claudeArguments(invocation),
      cwd: invocation.cwd,
      timeoutMs: invocation.maxSeconds * 1_000,
    });
    return parseClaude(run);
  },
};
