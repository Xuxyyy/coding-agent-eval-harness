import {accAdapter} from './acc.js';
import {claudeAdapter} from './claude.js';
import {codexAdapter} from './codex.js';
import type {AgentAdapter} from './types.js';

export function adapterById(id: string): AgentAdapter {
  if (id === 'acc') return accAdapter;
  if (id === 'codex') return codexAdapter;
  if (id === 'claude') return claudeAdapter;
  throw new Error(`unknown agent ${JSON.stringify(id)}; use acc, codex, or claude`);
}

export type {AdapterInvocation, AgentAdapter, AgentId} from './types.js';
