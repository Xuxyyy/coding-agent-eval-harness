import type {AdapterResult} from '../types/index.js';

export type AgentId = 'acc' | 'codex' | 'claude';

export type AdapterInvocation = {
  command: string;
  cwd: string;
  prompt: string;
  maxSeconds: number;
  model?: string;
  env?: NodeJS.ProcessEnv;
};

export interface AgentAdapter {
  readonly id: AgentId;
  run(invocation: AdapterInvocation): Promise<AdapterResult>;
  version(command: string, cwd: string): Promise<string>;
}
