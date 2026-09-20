import {dirname, join, relative, resolve} from 'node:path';
import type {AgentAdapter, AgentId} from '../adapters/types.js';
import {
  captureGitDiff,
  type ArtifactRunIdentity,
  type WriteTrialArtifactInput,
} from '../evidence/artifacts.js';
import {createFixture, removeFixture} from '../environments/fixture.js';
import {createTrialControl, type TrialControl} from '../environments/trial-control.js';
import {classifyTrial} from '../graders/classify-trial.js';
import {gradeCase} from '../graders/grade-case.js';
import {expectedDisposition, gradeTrialBehavior} from '../graders/grade-trial-behavior.js';
import type {
  AdapterResult,
  BehaviorGrade,
  CaseDefinition,
  ControlledEvent,
  GradeResult,
  TrialRecord,
} from '../types/index.js';

export type RunTrialOptions = {
  definition: CaseDefinition;
  repeat: number;
  agent: AgentId;
  command: string;
  model?: string;
  maxSeconds?: number;
  adapter: AgentAdapter;
  artifactRoot: string;
  resultPath: string;
  artifactWriter: (input: WriteTrialArtifactInput) => string;
  run: ArtifactRunIdentity;
};

function emptyGrade(): GradeResult {
  return {
    solved: false,
    clean: false,
    checks: [],
    changes: {added: [], modified: [], deleted: []},
    scopeViolations: [],
  };
}

function emptyBehavior(): BehaviorGrade {
  return {
    expectedDisposition: null,
    dispositionPassed: false,
    finalResponse: {passed: false, checks: []},
    controlledEvents: {passed: false, checks: [], events: []},
    passed: false,
  };
}

function failedAdapter(error: Error): AdapterResult {
  return {
    terminalStatus: 'error',
    finalMessage: null,
    usage: null,
    events: [{
      sequence: 1,
      kind: 'terminal',
      providerEventType: 'harness',
      status: 'error',
      message: error.message,
    }],
    publicSessionId: null,
    elapsedMs: 0,
    exitCode: null,
    signal: null,
    stdout: '',
    stderr: '',
    stdoutBytes: Buffer.alloc(0),
    stderrBytes: Buffer.alloc(0),
    truncated: {stdout: false, stderr: false},
    cleanup: {adapterHome: true, process: true},
    error: error.message,
  };
}

export async function runTrial(options: RunTrialOptions): Promise<TrialRecord> {
  const {definition} = options;
  let root: string | null = null;
  let initialCommit: string | null = null;
  let adapterResult: AdapterResult | null = null;
  let grade = emptyGrade();
  let behaviorGrade = emptyBehavior();
  let control: TrialControl | null = null;
  let controlEvents: ControlledEvent[] = [];
  let harnessError: string | undefined;
  let workspaceClean = false;
  let controlClean = true;
  let patch: Uint8Array = new Uint8Array();
  let patchTruncated = false;
  let patchCaptured = false;
  let evidenceReady = true;

  try {
    const fixture = createFixture(definition);
    root = fixture.root;
    initialCommit = fixture.initialCommit;
    if (definition.schemaVersion === 3 || definition.schemaVersion === 4) {
      control = await createTrialControl(definition, root);
    }
    const maxSeconds = options.maxSeconds === undefined
      ? definition.task.maxSeconds
      : Math.min(definition.task.maxSeconds, options.maxSeconds);
    adapterResult = await options.adapter.run({
      command: options.command,
      cwd: root,
      prompt: definition.task.prompt,
      maxSeconds,
      ...(options.model === undefined ? {} : {model: options.model}),
      ...(control === null ? {} : {env: control.env}),
    });
    grade = gradeCase(definition, root, fixture.before);
    if (control !== null) controlEvents = control.readEvents();
    behaviorGrade = gradeTrialBehavior(
      definition,
      adapterResult.terminalStatus,
      adapterResult.finalMessage,
      controlEvents,
      grade,
    );
    if (adapterResult.terminalStatus === 'error') {
      harnessError = adapterResult.error ?? 'adapter reported an unusable result';
    }
    if (!adapterResult.cleanup.adapterHome) {
      harnessError = 'adapter-owned home cleanup could not be confirmed';
    }
    if (!adapterResult.cleanup.process) {
      harnessError = 'process cleanup could not be confirmed';
    }
    try {
      const captured = await captureGitDiff(root, fixture.initialCommit);
      patch = captured.data;
      patchTruncated = captured.truncated;
      patchCaptured = true;
    } catch (error) {
      evidenceReady = false;
      harnessError = `Git diff evidence capture failed: ${(error as Error).message}`;
    }
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    harnessError = normalized.message;
    adapterResult ??= failedAdapter(normalized);
    if (root !== null && initialCommit !== null && !patchCaptured) {
      try {
        const captured = await captureGitDiff(root, initialCommit);
        patch = captured.data;
        patchTruncated = captured.truncated;
      } catch (captureError) {
        evidenceReady = false;
        harnessError = `${harnessError}; Git diff evidence capture failed: ${(captureError as Error).message}`;
      }
    }
  } finally {
    workspaceClean = root === null ? true : removeFixture(root);
    if (!workspaceClean) harnessError = 'workspace cleanup could not be confirmed';
    controlClean = control === null ? true : await control.cleanup();
    if (!controlClean) harnessError = 'control cleanup could not be confirmed';
  }

  adapterResult ??= failedAdapter(new Error(harnessError ?? 'unknown harness error'));
  const repositoryPassed = grade.solved && grade.clean;
  const behaviorPassed = behaviorGrade.passed;
  const trial: TrialRecord = {
    kind: 'trial',
    caseId: definition.id,
    repeat: options.repeat,
    adapter: options.agent,
    requestedModel: options.model ?? null,
    level: definition.schemaVersion === 1 ? null : definition.level,
    primaryModule: definition.schemaVersion === 4 ? definition.primaryModule : null,
    horizon: definition.schemaVersion === 4 ? definition.horizon : null,
    primaryQuality: definition.schemaVersion === 1 ? null : definition.primaryQuality,
    supportingQualities: definition.schemaVersion === 1 ? [] : definition.supportingQualities,
    startState: definition.schemaVersion === 1 ? null : definition.startState,
    expectedDisposition: expectedDisposition(definition),
    terminalStatus: adapterResult.terminalStatus,
    status: classifyTrial(adapterResult.terminalStatus, repositoryPassed, behaviorPassed, harnessError),
    solved: grade.solved,
    clean: grade.clean,
    repositoryPassed,
    behaviorPassed,
    repositoryGrade: grade,
    behaviorGrade,
    elapsedMs: adapterResult.elapsedMs,
    usage: adapterResult.usage,
    checks: grade.checks,
    changes: grade.changes,
    scopeViolations: grade.scopeViolations,
    cleanup: {
      workspace: workspaceClean,
      adapterHome: adapterResult.cleanup.adapterHome,
      process: adapterResult.cleanup.process,
      control: controlClean,
    },
    rawResultPath: null,
    artifactManifestPath: null,
    ...(harnessError === undefined ? {} : {error: harnessError}),
  };

  if (evidenceReady) {
    try {
      const artifactManifestPath = options.artifactWriter({
        artifactRoot: options.artifactRoot,
        resultPath: options.resultPath,
        trial,
        adapterResult,
        grade,
        behaviorGrade,
        controlEvents,
        patch,
        patchTruncated,
        run: options.run,
      });
      trial.artifactManifestPath = artifactManifestPath;
      trial.rawResultPath = relative(
        dirname(options.resultPath),
        join(dirname(resolve(dirname(options.resultPath), artifactManifestPath)), 'stdout.bin'),
      );
    } catch (error) {
      trial.status = 'error';
      trial.error = `evidence persistence failed: ${(error as Error).message}`;
      trial.artifactManifestPath = null;
      trial.rawResultPath = null;
    }
  }
  return trial;
}
