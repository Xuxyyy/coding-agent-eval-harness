export type Usage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  prompts?: number;
  steps?: number;
};

export type AdapterTerminalStatus = 'completed' | 'denied' | 'timeout' | 'failed' | 'error';
export type CanonicalEventBase = {
  sequence: number;
  providerEventType: string;
};
export type AssistantMessageEvent = CanonicalEventBase & {
  kind: 'assistant_message';
  text: string;
};
export type ToolCallEvent = CanonicalEventBase & {
  kind: 'tool_call';
  toolName: string | null;
  toolCallId: string | null;
};
export type ToolResultEvent = CanonicalEventBase & {
  kind: 'tool_result';
  toolName: string | null;
  toolCallId: string | null;
  status: string | null;
};
export type UsageEvent = CanonicalEventBase & {
  kind: 'usage';
  usage: Usage;
};
export type TerminalEvent = CanonicalEventBase & {
  kind: 'terminal';
  status: AdapterTerminalStatus;
  message: string | null;
};
export type OtherEvent = CanonicalEventBase & {kind: 'other'};
export type CanonicalEvent =
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | UsageEvent
  | TerminalEvent
  | OtherEvent;

export type AdapterResult = {
  terminalStatus: AdapterTerminalStatus;
  finalMessage: string | null;
  usage: Usage | null;
  events: CanonicalEvent[];
  publicSessionId: string | null;
  elapsedMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutBytes?: Uint8Array;
  stderrBytes?: Uint8Array;
  truncated: {stdout: boolean; stderr: boolean};
  cleanup: {adapterHome: boolean; process: boolean};
  error?: string;
};
