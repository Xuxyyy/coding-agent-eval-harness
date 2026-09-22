#!/usr/bin/env node
import {
  runEvaluation,
  type RunOptions,
} from '../engine/run-evaluation.js';
import type {AgentId} from '../adapters/types.js';
import type {CaseModule, CaseTier} from '../types/index.js';
import {existsSync, realpathSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectResult, type InspectOptions} from './inspect.js';
import {ProgressDisplay} from './progress.js';

export {inspectResult} from './inspect.js';
export type {InspectOptions} from './inspect.js';
export {formatTrialHeader, formatTrialRow} from './progress.js';

export const HELP = `Usage:
  agent-eval run --agent acc|codex|claude --command <executable> (--suite portable | --cases <directory>) [options]
  agent-eval inspect --result <jsonl> --case <id> --repeat <number>

Required:
  --agent <acc|codex|claude> Built-in adapter
  --command <executable>    One executable path or name; never a shell command

Suite selection (choose one):
  --suite portable          Bundled portable case suite
  --cases <directory>       Trusted custom case-suite directory

Options:
  --tier <tier>             Filter by baseline or challenge
  --module <module>         Filter by reasoning, execution, recovery, or verification
  --case <id>               Select one case; repeat to select more
  --repeats <number>        Sequential attempts per case (default: 1)
  --max-seconds <number>    Cap each case's declared time limit
  --model <id>              Forward an exact requested model when supported
  --output <file>           JSONL result path (default: ignored results/)
  -h, --help                Show this help

Inspect:
  --result <jsonl>          Version 2, 3, 4, 5, or 6 result JSONL
  --case <id>               Select one exact case ID
  --repeat <number>         Select one exact repeat number
`;

export type CliParse =
  | {help: true}
  | {help: false; options: RunOptions}
  | {help: false; inspect: InspectOptions};

function value(args: string[], index: number, flag: string): string {
  const found = args[index];
  if (found === undefined || found.length === 0) throw new Error(`${flag} requires a value`);
  return found;
}

function positiveInteger(raw: string, flag: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
}

export function bundledSuitePath(id: string): string {
  if (id !== 'portable') throw new Error(`unknown bundled suite: ${id}`);
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDir, '../../suites/portable'),
    resolve(moduleDir, '../../../suites/portable'),
  ];
  const found = candidates.find((candidate) => existsSync(resolve(candidate, 'suite.json')));
  if (found === undefined) throw new Error('bundled portable suite is missing');
  return found;
}

export function parseCliArgs(args: string[]): CliParse {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) return {help: true};
  if (args[0] === 'inspect') {
    let result: string | undefined;
    let caseId: string | undefined;
    let repeat: number | undefined;
    for (let index = 1; index < args.length; index += 1) {
      const flag = args[index]!;
      if (flag === '--result') {
        if (result !== undefined) throw new Error('--result may be provided only once');
        result = value(args, ++index, flag);
      } else if (flag === '--case') {
        if (caseId !== undefined) throw new Error('--case may be provided only once for inspect');
        caseId = value(args, ++index, flag);
      } else if (flag === '--repeat') {
        if (repeat !== undefined) throw new Error('--repeat may be provided only once for inspect');
        repeat = positiveInteger(value(args, ++index, flag), flag);
      } else {
        throw new Error(`unknown inspect argument: ${flag}`);
      }
    }
    if (result === undefined) throw new Error('--result is required for inspect');
    if (caseId === undefined) throw new Error('--case is required for inspect');
    if (repeat === undefined) throw new Error('--repeat is required for inspect');
    return {help: false, inspect: {result, caseId, repeat}};
  }
  if (args[0] !== 'run') throw new Error('first argument must be run or inspect');
  let agent: AgentId | undefined;
  let command: string | undefined;
  let casesDir: string | undefined;
  let suite: string | undefined;
  let repeats: number | undefined;
  let tier: CaseTier | undefined;
  let module: CaseModule | undefined;
  let maxSeconds: number | undefined;
  let model: string | undefined;
  let output: string | undefined;
  const caseIds: string[] = [];
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index]!;
    if (flag === '--agent') {
      const selected = value(args, ++index, flag);
      if (selected !== 'acc' && selected !== 'codex' && selected !== 'claude') {
        throw new Error('--agent must be acc, codex, or claude');
      }
      agent = selected;
    } else if (flag === '--command') {
      command = value(args, ++index, flag);
    } else if (flag === '--cases') {
      if (casesDir !== undefined) throw new Error('--cases may be provided only once');
      casesDir = value(args, ++index, flag);
    } else if (flag === '--suite') {
      if (suite !== undefined) throw new Error('--suite may be provided only once');
      suite = value(args, ++index, flag);
      if (suite !== 'portable') throw new Error('--suite must be portable');
    } else if (flag === '--case') {
      caseIds.push(value(args, ++index, flag));
    } else if (flag === '--tier') {
      if (tier !== undefined) throw new Error('--tier may be provided only once');
      const selected = value(args, ++index, flag);
      if (selected !== 'baseline' && selected !== 'challenge') {
        throw new Error('--tier must be baseline or challenge');
      }
      tier = selected;
    } else if (flag === '--module') {
      if (module !== undefined) throw new Error('--module may be provided only once');
      const selected = value(args, ++index, flag);
      if (
        selected !== 'reasoning' && selected !== 'execution' &&
        selected !== 'recovery' && selected !== 'verification'
      ) {
        throw new Error('--module must be reasoning, execution, recovery, or verification');
      }
      module = selected;
    } else if (flag === '--repeats') {
      repeats = positiveInteger(value(args, ++index, flag), flag);
    } else if (flag === '--max-seconds') {
      maxSeconds = positiveInteger(value(args, ++index, flag), flag);
    } else if (flag === '--model') {
      model = value(args, ++index, flag);
    } else if (flag === '--output') {
      output = value(args, ++index, flag);
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  if (agent === undefined) throw new Error('--agent is required');
  if (command === undefined) throw new Error('--command is required');
  if (casesDir !== undefined && suite !== undefined) {
    throw new Error('--suite cannot be combined with --cases');
  }
  if (casesDir === undefined && suite === undefined) {
    throw new Error('one of --suite or --cases is required');
  }
  if (caseIds.length > 0 && (tier !== undefined || module !== undefined)) {
    throw new Error('--case cannot be combined with --tier or --module');
  }
  return {
    help: false,
    options: {
      agent,
      command,
      casesDir: casesDir ?? bundledSuitePath(suite!),
      repeats: repeats ?? 1,
      ...(caseIds.length === 0 ? {} : {caseIds}),
      ...(tier === undefined ? {} : {tier}),
      ...(module === undefined ? {} : {module}),
      ...(maxSeconds === undefined ? {} : {maxSeconds}),
      ...(model === undefined ? {} : {model}),
      ...(output === undefined ? {} : {output}),
    },
  };
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  let progress: ProgressDisplay | undefined;
  try {
    const parsed = parseCliArgs(args);
    if (parsed.help) {
      process.stdout.write(HELP);
      return 0;
    }
    if ('inspect' in parsed) {
      process.stdout.write(`${inspectResult(parsed.inspect)}\n`);
      return 0;
    }
    progress = new ProgressDisplay(parsed.options);
    const result = await runEvaluation({
      ...parsed.options,
      onProgress: (event) => progress!.handle(event),
    });
    progress.finish(result);
    return result.exitCode;
  } catch (error) {
    progress?.stop();
    process.stderr.write(`agent-eval: ${(error as Error).message}\n`);
    return 2;
  }
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await main();
}
