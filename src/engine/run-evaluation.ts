import {appendFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {adapterById} from '../adapters/registry.js';
import type {AgentAdapter, AgentId} from '../adapters/types.js';
import {
  artifactRootForResult,
  writeTrialArtifact,
  type WriteTrialArtifactInput,
} from '../evidence/artifacts.js';
import {aggregate} from '../reports/aggregate.js';
import {profileVerdict} from '../reports/profile-verdict.js';
import {suiteContentHash} from '../suites/content-hash.js';
import {
  REPORT_SCHEMA_VERSION,
  TRIAL_ARTIFACT_SCHEMA_VERSION,
  type RunReport,
  type TrialRecord,
} from '../types/index.js';
import {runTrial} from './run-trial.js';
import {selectCases} from './select-cases.js';

export type RunOptions = {
  agent: AgentId;
  command: string;
  casesDir: string;
  caseIds?: string[];
  repeats?: number;
  profile?: string;
  maxSeconds?: number;
  model?: string;
  output?: string;
  adapter?: AgentAdapter;
  artifactWriter?: (input: WriteTrialArtifactInput) => string;
  onProgress?: (event: RunProgressEvent) => void;
};

export type RunProgressEvent =
  | {
    kind: 'run-start';
    caseIds: string[];
    repeats: number;
    total: number;
    profileId: string | null;
  }
  | {
    kind: 'trial-start';
    caseId: string;
    repeat: number;
    completed: number;
    total: number;
  }
  | {
    kind: 'trial-complete';
    trial: TrialRecord;
    completed: number;
    total: number;
  };

export type RunResult = {
  report: RunReport;
  trials: TrialRecord[];
  resultPath: string;
  exitCode: 0 | 1;
};

function resultFile(agent: string, output?: string): string {
  if (output !== undefined) return resolve(output);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve('results', `${stamp}-${agent}.jsonl`);
}

export async function runEvaluation(options: RunOptions): Promise<RunResult> {
  if (options.maxSeconds !== undefined && (!Number.isInteger(options.maxSeconds) || options.maxSeconds <= 0)) {
    throw new Error('max-seconds must be a positive integer');
  }
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const selection = selectCases(options);
  const {cases} = selection;
  if (cases.length === 0) throw new Error('the selected suite contains no cases');
  const total = cases.length * selection.repeats;
  options.onProgress?.({
    kind: 'run-start',
    caseIds: cases.map((item) => item.id),
    repeats: selection.repeats,
    total,
    profileId: selection.profile?.profileId ?? null,
  });

  const adapter = options.adapter ?? adapterById(options.agent);
  if (adapter.id !== options.agent) {
    throw new Error(`adapter id ${adapter.id} does not match requested agent ${options.agent}`);
  }
  const agentExecutableVersion = await adapter.version(options.command, process.cwd());
  const resultPath = resultFile(options.agent, options.output);
  mkdirSync(dirname(resultPath), {recursive: true});
  const artifactLayout = artifactRootForResult(resultPath);
  if (existsSync(artifactLayout.absolute)) {
    throw new Error(`artifact directory already exists: ${artifactLayout.absolute}`);
  }
  writeFileSync(resultPath, '');
  mkdirSync(artifactLayout.absolute);

  const suiteHash = suiteContentHash(cases);
  const artifactWriter = options.artifactWriter ?? writeTrialArtifact;
  const runIdentity = {
    startedAt,
    suiteContentHash: suiteHash,
    maxSecondsCap: options.maxSeconds ?? null,
    agentExecutableVersion,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
  const trials: TrialRecord[] = [];
  for (const definition of cases) {
    for (let repeat = 1; repeat <= selection.repeats; repeat += 1) {
      options.onProgress?.({
        kind: 'trial-start',
        caseId: definition.id,
        repeat,
        completed: trials.length,
        total,
      });
      const trial = await runTrial({
        definition,
        repeat,
        agent: options.agent,
        command: options.command,
        ...(options.model === undefined ? {} : {model: options.model}),
        ...(options.maxSeconds === undefined ? {} : {maxSeconds: options.maxSeconds}),
        adapter,
        artifactRoot: artifactLayout.absolute,
        resultPath,
        artifactWriter,
        run: runIdentity,
      });
      trials.push(trial);
      appendFileSync(resultPath, `${JSON.stringify(trial)}\n`);
      options.onProgress?.({
        kind: 'trial-complete',
        trial,
        completed: trials.length,
        total,
      });
    }
  }

  const requirement = selection.profile === null
    ? undefined
    : {caseIds: selection.profile.caseIds, repeats: selection.profile.repeats};
  const summary = aggregate(trials, requirement);
  const report: RunReport = {
    kind: 'report',
    schemaVersion: REPORT_SCHEMA_VERSION,
    requestedAdapter: options.agent,
    requestedModel: options.model ?? null,
    agentExecutableVersion,
    startedAt,
    elapsedMs: Date.now() - started,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    repeats: selection.repeats,
    selectedCaseIds: cases.map((item) => item.id),
    profile: selection.profile,
    profileVerdict: requirement === undefined ? null : profileVerdict(trials, requirement),
    maxSecondsCap: options.maxSeconds ?? null,
    suiteContentHash: suiteHash,
    artifactSchemaVersion: TRIAL_ARTIFACT_SCHEMA_VERSION,
    artifactRoot: artifactLayout.relative,
    caseSchemaVersions: Object.fromEntries(cases.map((item) => [item.id, item.schemaVersion])),
    terminalStatus: summary.errors > 0
      ? 'error'
      : summary.passes.count === summary.passes.of
        ? 'completed'
        : 'failed',
    aggregate: summary,
    cleanup: {
      workspaces: trials.every((trial) => trial.cleanup.workspace),
      adapterHomes: trials.every((trial) => trial.cleanup.adapterHome),
      processes: trials.every((trial) => trial.cleanup.process),
    },
  };
  appendFileSync(resultPath, `${JSON.stringify(report)}\n`);
  return {
    report,
    trials,
    resultPath,
    exitCode: trials.every((trial) => trial.status === 'pass') ? 0 : 1,
  };
}

export function formatSummary(result: RunResult): string {
  const lines = ['case\trepeat\tstatus\tsolved\tclean\tterminal\telapsed_ms\ttotal_tokens'];
  for (const trial of result.trials) {
    lines.push([
      trial.caseId,
      String(trial.repeat),
      trial.status,
      String(trial.solved),
      String(trial.clean),
      trial.terminalStatus,
      String(trial.elapsedMs),
      String(trial.usage?.totalTokens ?? '-'),
    ].join('\t'));
  }
  lines.push(
    `report\t${result.report.terminalStatus}\tpasses ${result.report.aggregate.passes.count}/${result.report.aggregate.passes.of}\terrors ${result.report.aggregate.errors}`,
  );
  if (result.report.profile !== null) {
    lines.push(
      `profile\t${result.report.profile.profileId}\tverdict ${result.report.profileVerdict}`,
    );
  }
  lines.push(`result\t${result.resultPath}`);
  return lines.join('\n');
}

export {suiteContentHash} from '../suites/content-hash.js';
