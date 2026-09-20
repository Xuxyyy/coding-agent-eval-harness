import {spawnSync} from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import type {
  ControlledEvent,
  MeasurementCaseDefinition,
  ModuleCaseDefinition,
  ProbeOutcome,
} from '../types/index.js';

export const CONTROL_PREFIX = 'agent-eval-control-';
export const CONTROL_EVENT_LIMIT = 100;
export const CONTROL_BYTES_LIMIT = 64 * 1024;

export type TrialControl = {
  root: string | null;
  env: NodeJS.ProcessEnv;
  readEvents(): ControlledEvent[];
  cleanup(): Promise<boolean>;
};

function envName(probeId: string): string {
  return `AGENT_EVAL_PROBE_${probeId.replace(/-/gu, '_').toUpperCase()}`;
}

function helperSource(requests: string, probeId: string): string {
  return `#!/usr/bin/env node
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const id=process.pid+'-'+randomBytes(8).toString('hex');
const request=join(${JSON.stringify(requests)},id+'.json');
const temporary=request+'.tmp';
const response=join(${JSON.stringify(requests)},id+'.response');
writeFileSync(temporary,JSON.stringify({probeId:${JSON.stringify(probeId)}}),{encoding:'utf8',flag:'wx',mode:0o600});
renameSync(temporary,request);
const started=Date.now();
const timer=setInterval(()=>{if(!existsSync(response)){if(Date.now()-started>60000){clearInterval(timer);console.error('control response timed out');process.exit(70)}return}clearInterval(timer);try{const result=JSON.parse(readFileSync(response,'utf8'));unlinkSync(response);if(existsSync(request))unlinkSync(request);if(result.message)console.error(result.message);process.exit(result.status)}catch(error){console.error('invalid control response');process.exit(70)}},10);
`;
}

export async function createTrialControl(
  definition: MeasurementCaseDefinition | ModuleCaseDefinition,
  workspaceRoot: string,
): Promise<TrialControl> {
  if (definition.trialChecks.controlledEvents.length === 0) {
    return {root: null, env: {}, readEvents: () => [], cleanup: async () => true};
  }
  const root = mkdtempSync(join(tmpdir(), CONTROL_PREFIX));
  const requests = join(root, 'requests');
  mkdirSync(requests);
  const log = join(root, 'events.jsonl');
  const events: ControlledEvent[] = [];
  const checks = new Map(definition.trialChecks.controlledEvents.map((probe) => [probe.probeId, probe]));
  const calls = new Map<string, number>();
  const processed = new Set<string>();
  let active = true;

  const processRequests = (): void => {
    if (!active || !existsSync(requests)) return;
    for (const name of readdirSync(requests).filter((entry) => entry.endsWith('.json')).sort()) {
      if (processed.has(name)) continue;
      processed.add(name);
      const requestPath = join(requests, name);
      const responsePath = join(requests, `${basename(name, '.json')}.response`);
      let probeId = '';
      try {
        const raw = JSON.parse(readFileSync(requestPath, 'utf8')) as unknown;
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          const source = raw as Record<string, unknown>;
          if (Object.keys(source).join(',') === 'probeId' && typeof source.probeId === 'string') {
            probeId = source.probeId;
          }
        }
      } catch {
        // The invalid request receives a controlled error below.
      }
      const check = checks.get(probeId);
      if (check === undefined || events.length >= CONTROL_EVENT_LIMIT) {
        writeFileSync(responsePath, JSON.stringify({status: 70, message: 'invalid or excessive control request'}));
        continue;
      }
      const count = calls.get(probeId) ?? 0;
      calls.set(probeId, count + 1);
      let outcome: ProbeOutcome;
      let status: number;
      let message: string | undefined;
      if (check.strategy === 'unavailable') {
        outcome = 'unavailable';
        status = 69;
        message = 'controlled verification tool unavailable';
      } else if (check.strategy === 'transient-first' && count === 0) {
        outcome = 'transient-failure';
        status = 75;
        message = 'controlled transient verification failure';
      } else {
        if (check.command === null) throw new Error(`probe ${probeId} has no command`);
        const {NODE_TEST_CONTEXT: _nodeTestContext, ...environment} = process.env;
        const run = spawnSync(check.command, {
          cwd: workspaceRoot,
          shell: true,
          stdio: 'ignore',
          env: environment,
        });
        outcome = run.status === 0 && run.error === undefined ? 'passed' : 'failed';
        status = outcome === 'passed' ? 0 : 1;
      }
      const event = {sequence: events.length + 1, probeId, outcome};
      events.push(event);
      appendFileSync(log, `${JSON.stringify(event)}\n`, {encoding: 'utf8', flag: 'a', mode: 0o600});
      writeFileSync(responsePath, JSON.stringify({status, ...(message === undefined ? {} : {message})}), {
        encoding: 'utf8', flag: 'wx', mode: 0o600,
      });
      if (existsSync(requestPath)) unlinkSync(requestPath);
    }
  };

  const timer = setInterval(processRequests, 10);
  timer.unref();
  try {
    const env: NodeJS.ProcessEnv = {};
    for (const probe of definition.trialChecks.controlledEvents) {
      const helper = join(root, probe.probeId);
      writeFileSync(helper, helperSource(requests, probe.probeId), {mode: 0o500});
      chmodSync(helper, 0o500);
      env[envName(probe.probeId)] = helper;
    }
    return {
      root,
      env,
      readEvents() {
        processRequests();
        if (!existsSync(log)) {
          if (events.length !== 0) throw new Error('control event log is missing');
          return [];
        }
        const data = readFileSync(log);
        if (data.byteLength > CONTROL_BYTES_LIMIT) throw new Error('control event log exceeds byte limit');
        const lines = data.toString('utf8').split(/\r?\n/u).filter(Boolean);
        if (lines.length > CONTROL_EVENT_LIMIT) throw new Error('control event log exceeds event limit');
        const parsed = lines.map((line, index) => {
          let raw: unknown;
          try { raw = JSON.parse(line); } catch (error) {
            throw new Error(`invalid control event JSONL at line ${index + 1}: ${(error as Error).message}`);
          }
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            throw new Error(`control event ${index + 1} must be an object`);
          }
          const event = raw as Record<string, unknown>;
          if (Object.keys(event).sort().join(',') !== 'outcome,probeId,sequence') {
            throw new Error(`control event ${index + 1} has invalid fields`);
          }
          if (event.sequence !== index + 1) throw new Error(`control event sequence must be contiguous at ${index + 1}`);
          if (!checks.has(String(event.probeId))) throw new Error(`control event ${index + 1} has unknown probe ID`);
          if (!['transient-failure', 'unavailable', 'passed', 'failed'].includes(String(event.outcome))) {
            throw new Error(`control event ${index + 1} has invalid outcome`);
          }
          return {
            sequence: index + 1,
            probeId: event.probeId as string,
            outcome: event.outcome as ProbeOutcome,
          };
        });
        if (JSON.stringify(parsed) !== JSON.stringify(events)) {
          throw new Error('control event log does not match harness-owned events');
        }
        return parsed;
      },
      async cleanup() {
        active = false;
        clearInterval(timer);
        try {
          rmSync(root, {recursive: true, force: true});
          return !existsSync(root);
        } catch {
          return false;
        }
      },
    };
  } catch (error) {
    active = false;
    clearInterval(timer);
    rmSync(root, {recursive: true, force: true});
    throw error;
  }
}
