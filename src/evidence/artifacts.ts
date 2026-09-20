import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {basename, dirname, join, posix, relative, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {runProcess} from '../environments/process.js';
import {
  LEGACY_REPORT_SCHEMA_VERSION,
  LEGACY_TRIAL_ARTIFACT_SCHEMA_VERSION,
  MEASUREMENT_REPORT_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  STRUCTURED_REPORT_SCHEMA_VERSION,
  TRIAL_ARTIFACT_SCHEMA_VERSION,
  type AdapterResult,
  type ArtifactFileReference,
  type CanonicalEvent,
  type BehaviorGrade,
  type ControlledEvent,
  type GradeResult,
  type LegacyTrialArtifact,
  type TrialArtifact,
  type TrialRecord,
} from '../types/index.js';

export const GIT_DIFF_LIMIT_BYTES = 1024 * 1024;
export const INSPECT_SECTION_LIMIT = 16 * 1024;
export const GIT_INDEX_PREFIX = 'agent-eval-index-';

type JsonObject = Record<string, unknown>;

export type ParsedResultFile = {
  schemaVersion:
    | typeof LEGACY_REPORT_SCHEMA_VERSION
    | typeof STRUCTURED_REPORT_SCHEMA_VERSION
    | typeof MEASUREMENT_REPORT_SCHEMA_VERSION
    | typeof REPORT_SCHEMA_VERSION;
  trials: JsonObject[];
  report: JsonObject;
};

export type ArtifactRunIdentity = TrialArtifact['run'] & TrialArtifact['environment'];

export type WriteTrialArtifactInput = {
  artifactRoot: string;
  resultPath: string;
  trial: TrialRecord;
  adapterResult: AdapterResult;
  grade: GradeResult;
  behaviorGrade: BehaviorGrade;
  controlEvents: ControlledEvent[];
  patch: Uint8Array;
  patchTruncated: boolean;
  run: ArtifactRunIdentity;
};

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a string`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  return array(value, label).map((item, index) => string(item, `${label}[${index}]`));
}

function validateUsage(value: unknown, label: string): void {
  if (value === null) return;
  const usage = object(value, label);
  for (const key of ['inputTokens', 'cachedInputTokens', 'outputTokens', 'totalTokens', 'prompts', 'steps']) {
    if (usage[key] !== undefined) integer(usage[key], `${label}.${key}`);
  }
}

function validateCleanup(value: unknown, label: string, workspace: boolean, control = false): void {
  const cleanup = object(value, label);
  if (workspace) boolean(cleanup.workspace, `${label}.workspace`);
  boolean(cleanup.adapterHome, `${label}.adapterHome`);
  boolean(cleanup.process, `${label}.process`);
  if (control) boolean(cleanup.control, `${label}.control`);
}

function validateChanges(value: unknown, label: string): void {
  const changes = object(value, label);
  stringArray(changes.added, `${label}.added`);
  stringArray(changes.modified, `${label}.modified`);
  stringArray(changes.deleted, `${label}.deleted`);
}

function validateGrade(value: unknown, label: string): void {
  const grade = object(value, label);
  boolean(grade.solved, `${label}.solved`);
  boolean(grade.clean, `${label}.clean`);
  array(grade.checks, `${label}.checks`).forEach((item, index) => {
    const check = object(item, `${label}.checks[${index}]`);
    object(check.check, `${label}.checks[${index}].check`);
    boolean(check.ok, `${label}.checks[${index}].ok`);
    if (typeof check.detail !== 'string') throw new Error(`${label}.checks[${index}].detail must be a string`);
  });
  validateChanges(grade.changes, `${label}.changes`);
  stringArray(grade.scopeViolations, `${label}.scopeViolations`);
}

function validateControlledEvents(value: unknown, label: string): ControlledEvent[] {
  return array(value, label).map((item, index) => {
    const event = object(item, `${label}[${index}]`);
    const sequence = integer(event.sequence, `${label}[${index}].sequence`, 1);
    if (sequence !== index + 1) throw new Error(`${label} sequence must be contiguous at ${index + 1}`);
    const probeId = string(event.probeId, `${label}[${index}].probeId`);
    const outcome = oneOf(
      event.outcome,
      ['transient-failure', 'unavailable', 'passed', 'failed'] as const,
      `${label}[${index}].outcome`,
    );
    return {sequence, probeId, outcome};
  });
}

function validateBehaviorGrade(value: unknown, label: string): void {
  const grade = object(value, label);
  if (grade.expectedDisposition !== null) {
    oneOf(grade.expectedDisposition, ['implemented', 'no-change', 'blocked'], `${label}.expectedDisposition`);
  }
  boolean(grade.dispositionPassed, `${label}.dispositionPassed`);
  const finalResponse = object(grade.finalResponse, `${label}.finalResponse`);
  boolean(finalResponse.passed, `${label}.finalResponse.passed`);
  array(finalResponse.checks, `${label}.finalResponse.checks`).forEach((item, index) => {
    const check = object(item, `${label}.finalResponse.checks[${index}]`);
    oneOf(check.kind, ['required', 'forbidden'], `${label}.finalResponse.checks[${index}].kind`);
    string(check.pattern, `${label}.finalResponse.checks[${index}].pattern`);
    boolean(check.ok, `${label}.finalResponse.checks[${index}].ok`);
    if (typeof check.detail !== 'string') throw new Error(`${label}.finalResponse.checks[${index}].detail must be a string`);
  });
  const controlled = object(grade.controlledEvents, `${label}.controlledEvents`);
  boolean(controlled.passed, `${label}.controlledEvents.passed`);
  array(controlled.checks, `${label}.controlledEvents.checks`).forEach((item, index) => {
    const check = object(item, `${label}.controlledEvents.checks[${index}]`);
    string(check.probeId, `${label}.controlledEvents.checks[${index}].probeId`);
    array(check.expectedOutcomes, `${label}.controlledEvents.checks[${index}].expectedOutcomes`).forEach(
      (outcome, outcomeIndex) => oneOf(
        outcome,
        ['transient-failure', 'unavailable', 'passed', 'failed'],
        `${label}.controlledEvents.checks[${index}].expectedOutcomes[${outcomeIndex}]`,
      ),
    );
    boolean(check.ok, `${label}.controlledEvents.checks[${index}].ok`);
    if (typeof check.detail !== 'string') throw new Error(`${label}.controlledEvents.checks[${index}].detail must be a string`);
  });
  validateControlledEvents(controlled.events, `${label}.controlledEvents.events`);
  boolean(grade.passed, `${label}.passed`);
}

export function safeArtifactPath(value: unknown, label = 'artifact path'): string {
  const path = string(value, label);
  if (
    path.includes('\\') ||
    path.startsWith('/') ||
    path === '.' ||
    path === '..' ||
    posix.normalize(path) !== path ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`${label} must be a normalized relative path`);
  }
  return path;
}

export function resolveBeneath(base: string, relativePath: string, label = 'artifact path'): string {
  const safe = safeArtifactPath(relativePath, label);
  const root = resolve(base);
  const target = resolve(root, safe);
  const fromRoot = relative(root, target);
  if (fromRoot === '' || fromRoot.startsWith('..') || fromRoot.startsWith('/')) {
    throw new Error(`${label} escapes its allowed directory`);
  }
  return target;
}

export function artifactRootForResult(resultPath: string): {absolute: string; relative: string} {
  const name = basename(resultPath).replace(/\.jsonl$/u, '');
  const relativePath = `${name}.artifacts`;
  return {absolute: join(dirname(resultPath), relativePath), relative: relativePath};
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function writeEvidenceFile(
  directory: string,
  path: string,
  data: Uint8Array,
  truncated: boolean,
): ArtifactFileReference {
  writeFileSync(join(directory, path), data);
  return {path, bytes: data.byteLength, sha256: sha256(data), truncated};
}

function eventJsonl(events: readonly CanonicalEvent[]): Buffer {
  if (events.length === 0) return Buffer.alloc(0);
  return Buffer.from(`${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

export async function captureGitDiff(
  root: string,
  initialCommit: string,
): Promise<{data: Buffer; truncated: boolean}> {
  const temporary = mkdtempSync(join(tmpdir(), GIT_INDEX_PREFIX));
  const index = join(temporary, 'index');
  const env = {...process.env, GIT_INDEX_FILE: index};
  try {
    for (const args of [['read-tree', initialCommit], ['add', '--all']]) {
      const staged = spawnSync('git', args, {cwd: root, encoding: 'utf8', env});
      if (staged.error !== undefined || staged.status !== 0) {
        throw new Error(`git ${args.join(' ')} for evidence failed: ${staged.error?.message ?? staged.stderr.trim()}`);
      }
    }
    const diff = await runProcess({
      command: 'git',
      args: ['diff', '--cached', '--binary', '--no-ext-diff', initialCommit],
      cwd: root,
      env: {GIT_INDEX_FILE: index},
      timeoutMs: 30_000,
      outputLimitBytes: GIT_DIFF_LIMIT_BYTES,
    });
    if (diff.error !== undefined || diff.exitCode !== 0 || diff.timedOut || !diff.cleanupComplete) {
      throw new Error(
        `git diff evidence failed: ${diff.error ?? (diff.stderr.trim() || `exit ${diff.exitCode}`)}`,
      );
    }
    return {
      data: Buffer.from(diff.stdoutBytes),
      truncated: diff.truncated.stdout,
    };
  } finally {
    rmSync(temporary, {recursive: true, force: true});
  }
}

export function writeTrialArtifact(input: WriteTrialArtifactInput): string {
  const caseDirectory = join(input.artifactRoot, 'cases', encodeURIComponent(input.trial.caseId));
  mkdirSync(caseDirectory, {recursive: true});
  const directory = join(caseDirectory, `repeat-${input.trial.repeat}`);
  mkdirSync(directory, {recursive: false});

  const stdout = Buffer.from(input.adapterResult.stdoutBytes ?? Buffer.from(input.adapterResult.stdout));
  const stderr = Buffer.from(input.adapterResult.stderrBytes ?? Buffer.from(input.adapterResult.stderr));
  const events = eventJsonl(input.adapterResult.events);
  const patch = Buffer.from(input.patch);
  const files = {
    stdout: writeEvidenceFile(directory, 'stdout.bin', stdout, input.adapterResult.truncated.stdout),
    stderr: writeEvidenceFile(directory, 'stderr.bin', stderr, input.adapterResult.truncated.stderr),
    events: writeEvidenceFile(directory, 'events.jsonl', events, false),
    diff: writeEvidenceFile(directory, 'final.patch', patch, input.patchTruncated),
  };
  const artifact: TrialArtifact = {
    kind: 'trial-artifact',
    schemaVersion: TRIAL_ARTIFACT_SCHEMA_VERSION,
    identity: {
      caseId: input.trial.caseId,
      repeat: input.trial.repeat,
      adapter: input.trial.adapter,
      requestedModel: input.trial.requestedModel,
      publicSessionId: input.adapterResult.publicSessionId,
    },
    run: {
      startedAt: input.run.startedAt,
      suiteContentHash: input.run.suiteContentHash,
      maxSecondsCap: input.run.maxSecondsCap,
    },
    environment: {
      agentExecutableVersion: input.run.agentExecutableVersion,
      node: input.run.node,
      platform: input.run.platform,
    },
    outcome: {
      terminalStatus: input.trial.terminalStatus,
      status: input.trial.status,
      solved: input.trial.solved,
      clean: input.trial.clean,
      repositoryPassed: input.trial.repositoryPassed,
      behaviorPassed: input.trial.behaviorPassed,
    },
    finalMessage: input.adapterResult.finalMessage,
    usage: input.adapterResult.usage,
    elapsedMs: input.adapterResult.elapsedMs,
    repositoryGrade: input.grade,
    behaviorGrade: input.behaviorGrade,
    controlEvents: input.controlEvents,
    errors: input.trial.error === undefined ? [] : [input.trial.error],
    cleanup: input.trial.cleanup,
    files,
  };
  const temporary = join(directory, 'manifest.json.tmp');
  const manifest = join(directory, 'manifest.json');
  writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, {flag: 'wx'});
  renameSync(temporary, manifest);
  return relative(dirname(input.resultPath), manifest);
}

function validateTrialRecord(
  value: unknown,
  index: number,
  measurement: boolean,
  modules: boolean,
): JsonObject {
  const trial = object(value, `record ${index}`);
  if (trial.kind !== 'trial') throw new Error(`record ${index} must be a trial`);
  string(trial.caseId, `record ${index}.caseId`);
  integer(trial.repeat, `record ${index}.repeat`, 1);
  string(trial.adapter, `record ${index}.adapter`);
  nullableString(trial.requestedModel, `record ${index}.requestedModel`);
  if (trial.level !== null) oneOf(trial.level, ['focused', 'workflow'], `record ${index}.level`);
  if (modules) {
    if (trial.primaryModule !== null) {
      oneOf(
        trial.primaryModule,
        ['reasoning', 'execution', 'recovery', 'verification'],
        `record ${index}.primaryModule`,
      );
    }
    if (trial.horizon !== null) {
      oneOf(trial.horizon, ['short', 'multi-stage', 'long-horizon'], `record ${index}.horizon`);
    }
  }
  if (trial.primaryQuality !== null) string(trial.primaryQuality, `record ${index}.primaryQuality`);
  stringArray(trial.supportingQualities, `record ${index}.supportingQualities`);
  if (trial.startState !== null) oneOf(trial.startState, ['unsolved', 'satisfied'], `record ${index}.startState`);
  if (measurement) {
    if (trial.expectedDisposition !== null) {
      oneOf(trial.expectedDisposition, ['implemented', 'no-change', 'blocked'], `record ${index}.expectedDisposition`);
    }
  }
  oneOf(trial.terminalStatus, ['completed', 'denied', 'timeout', 'failed', 'error'], `record ${index}.terminalStatus`);
  oneOf(trial.status, ['pass', 'fail', 'error'], `record ${index}.status`);
  boolean(trial.solved, `record ${index}.solved`);
  boolean(trial.clean, `record ${index}.clean`);
  if (measurement) {
    boolean(trial.repositoryPassed, `record ${index}.repositoryPassed`);
    boolean(trial.behaviorPassed, `record ${index}.behaviorPassed`);
    validateGrade(trial.repositoryGrade, `record ${index}.repositoryGrade`);
    validateBehaviorGrade(trial.behaviorGrade, `record ${index}.behaviorGrade`);
  }
  integer(trial.elapsedMs, `record ${index}.elapsedMs`);
  validateUsage(trial.usage, `record ${index}.usage`);
  array(trial.checks, `record ${index}.checks`);
  validateChanges(trial.changes, `record ${index}.changes`);
  stringArray(trial.scopeViolations, `record ${index}.scopeViolations`);
  validateCleanup(trial.cleanup, `record ${index}.cleanup`, true, measurement);
  if (trial.artifactManifestPath !== null) {
    safeArtifactPath(trial.artifactManifestPath, `record ${index}.artifactManifestPath`);
  }
  if (trial.rawResultPath !== null) {
    safeArtifactPath(trial.rawResultPath, `record ${index}.rawResultPath`);
  }
  return trial;
}

export function readResultFile(resultPath: string): ParsedResultFile {
  let text: string;
  try {
    text = readFileSync(resultPath, 'utf8');
  } catch (error) {
    throw new Error(`could not read result file: ${(error as Error).message}`);
  }
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error('result file is empty');
  const records = lines.map((line, index) => {
    try {
      return object(JSON.parse(line), `record ${index + 1}`);
    } catch (error) {
      throw new Error(`invalid result JSONL at line ${index + 1}: ${(error as Error).message}`);
    }
  });
  const report = records.at(-1)!;
  if (report.kind !== 'report') throw new Error('last result record must be a report');
  const schemaVersion = integer(report.schemaVersion, 'report.schemaVersion', 1);
  if (
    schemaVersion !== LEGACY_REPORT_SCHEMA_VERSION &&
    schemaVersion !== STRUCTURED_REPORT_SCHEMA_VERSION &&
    schemaVersion !== MEASUREMENT_REPORT_SCHEMA_VERSION &&
    schemaVersion !== REPORT_SCHEMA_VERSION
  ) {
    throw new Error(`unsupported report schema version: ${schemaVersion}`);
  }
  const trials = records.slice(0, -1);
  if (
    schemaVersion === STRUCTURED_REPORT_SCHEMA_VERSION ||
    schemaVersion === MEASUREMENT_REPORT_SCHEMA_VERSION ||
    schemaVersion === REPORT_SCHEMA_VERSION
  ) {
    string(report.requestedAdapter, 'report.requestedAdapter');
    nullableString(report.requestedModel, 'report.requestedModel');
    string(report.agentExecutableVersion, 'report.agentExecutableVersion');
    string(report.startedAt, 'report.startedAt');
    integer(report.elapsedMs, 'report.elapsedMs');
    string(report.node, 'report.node');
    string(report.platform, 'report.platform');
    integer(report.repeats, 'report.repeats', 1);
    stringArray(report.selectedCaseIds, 'report.selectedCaseIds');
    if (report.profile !== null) object(report.profile, 'report.profile');
    if (report.profileVerdict !== null) {
      oneOf(report.profileVerdict, ['met', 'not_met', 'incomplete'], 'report.profileVerdict');
    }
    if (report.maxSecondsCap !== null) integer(report.maxSecondsCap, 'report.maxSecondsCap', 1);
    string(report.suiteContentHash, 'report.suiteContentHash');
    const expectedArtifactVersion = schemaVersion === STRUCTURED_REPORT_SCHEMA_VERSION
      ? LEGACY_TRIAL_ARTIFACT_SCHEMA_VERSION
      : TRIAL_ARTIFACT_SCHEMA_VERSION;
    if (report.artifactSchemaVersion !== expectedArtifactVersion) {
      throw new Error(`unsupported artifact schema version: ${String(report.artifactSchemaVersion)}`);
    }
    safeArtifactPath(report.artifactRoot, 'report.artifactRoot');
    const caseSchemaVersions = object(report.caseSchemaVersions, 'report.caseSchemaVersions');
    for (const [caseId, version] of Object.entries(caseSchemaVersions)) {
      string(caseId, 'report.caseSchemaVersions key');
      const parsedVersion = integer(version, `report.caseSchemaVersions.${caseId}`, 1);
      const supported = parsedVersion === 1 || parsedVersion === 2 ||
        ((schemaVersion === MEASUREMENT_REPORT_SCHEMA_VERSION || schemaVersion === REPORT_SCHEMA_VERSION) && parsedVersion === 3) ||
        (schemaVersion === REPORT_SCHEMA_VERSION && parsedVersion === 4);
      if (!supported) {
        throw new Error(`report.caseSchemaVersions.${caseId} must be supported by report schema ${schemaVersion}`);
      }
    }
    oneOf(report.terminalStatus, ['completed', 'failed', 'error'], 'report.terminalStatus');
    object(report.aggregate, 'report.aggregate');
    const cleanup = object(report.cleanup, 'report.cleanup');
    boolean(cleanup.workspaces, 'report.cleanup.workspaces');
    boolean(cleanup.adapterHomes, 'report.cleanup.adapterHomes');
    boolean(cleanup.processes, 'report.cleanup.processes');
    const measurement = schemaVersion === MEASUREMENT_REPORT_SCHEMA_VERSION ||
      schemaVersion === REPORT_SCHEMA_VERSION;
    if (measurement) boolean(cleanup.controls, 'report.cleanup.controls');
    trials.forEach((trial, index) =>
      validateTrialRecord(trial, index + 1, measurement, schemaVersion === REPORT_SCHEMA_VERSION));
  } else {
    for (const [index, trialValue] of trials.entries()) {
      const trial = object(trialValue, `record ${index + 1}`);
      if (trial.kind !== 'trial') throw new Error(`record ${index + 1} must be a trial`);
      string(trial.caseId, `record ${index + 1}.caseId`);
      integer(trial.repeat, `record ${index + 1}.repeat`, 1);
    }
  }
  return {schemaVersion, trials, report};
}

function validateFileReference(value: unknown, label: string): ArtifactFileReference {
  const reference = object(value, label);
  const path = safeArtifactPath(reference.path, `${label}.path`);
  const bytes = integer(reference.bytes, `${label}.bytes`);
  const digest = string(reference.sha256, `${label}.sha256`);
  if (!/^[a-f0-9]{64}$/u.test(digest)) throw new Error(`${label}.sha256 must be a SHA-256 digest`);
  const truncated = boolean(reference.truncated, `${label}.truncated`);
  return {path, bytes, sha256: digest, truncated};
}

function validateCanonicalEvent(value: unknown, expectedSequence: number): CanonicalEvent {
  const event = object(value, `event ${expectedSequence}`);
  if (integer(event.sequence, `event ${expectedSequence}.sequence`, 1) !== expectedSequence) {
    throw new Error(`event sequence must be contiguous at ${expectedSequence}`);
  }
  string(event.providerEventType, `event ${expectedSequence}.providerEventType`);
  const kind = string(event.kind, `event ${expectedSequence}.kind`);
  if (!['assistant_message', 'tool_call', 'tool_result', 'usage', 'terminal', 'other'].includes(kind)) {
    throw new Error(`event ${expectedSequence} has unknown canonical kind: ${kind}`);
  }
  if (kind === 'assistant_message') string(event.text, `event ${expectedSequence}.text`);
  if (kind === 'usage') {
    object(event.usage, `event ${expectedSequence}.usage`);
    validateUsage(event.usage, `event ${expectedSequence}.usage`);
  }
  if (kind === 'tool_call') {
    nullableString(event.toolName, `event ${expectedSequence}.toolName`);
    nullableString(event.toolCallId, `event ${expectedSequence}.toolCallId`);
  }
  if (kind === 'tool_result') {
    nullableString(event.toolName, `event ${expectedSequence}.toolName`);
    nullableString(event.toolCallId, `event ${expectedSequence}.toolCallId`);
    nullableString(event.status, `event ${expectedSequence}.status`);
  }
  if (kind === 'terminal') {
    oneOf(event.status, ['completed', 'denied', 'timeout', 'failed', 'error'], `event ${expectedSequence}.status`);
    nullableString(event.message, `event ${expectedSequence}.message`);
  }
  return event as CanonicalEvent;
}

function readVerifiedFile(directory: string, reference: ArtifactFileReference, label: string): Buffer {
  const path = resolveBeneath(directory, reference.path, `${label}.path`);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${label} is missing`);
  const realDirectory = realpathSync(directory);
  const realPath = realpathSync(path);
  const fromDirectory = relative(realDirectory, realPath);
  if (fromDirectory.startsWith('..') || fromDirectory.startsWith('/')) {
    throw new Error(`${label}.path escapes its allowed directory through a symlink`);
  }
  const data = readFileSync(path);
  if (data.byteLength !== reference.bytes) throw new Error(`${label} byte count does not match manifest`);
  if (sha256(data) !== reference.sha256) throw new Error(`${label} digest does not match manifest`);
  return data;
}

export function readTrialArtifact(
  resultPath: string,
  trial: JsonObject,
): {
  manifest: TrialArtifact | LegacyTrialArtifact;
  stdout: Buffer;
  stderr: Buffer;
  events: CanonicalEvent[];
  diff: Buffer;
} {
  const manifestRelative = safeArtifactPath(trial.artifactManifestPath, 'trial.artifactManifestPath');
  const manifestPath = resolveBeneath(dirname(resultPath), manifestRelative, 'trial.artifactManifestPath');
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    throw new Error('artifact manifest is missing');
  }
  const realResultDirectory = realpathSync(dirname(resultPath));
  const realManifestPath = realpathSync(manifestPath);
  const fromResult = relative(realResultDirectory, realManifestPath);
  if (fromResult.startsWith('..') || fromResult.startsWith('/')) {
    throw new Error('artifact manifest escapes the result directory through a symlink');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`could not read artifact manifest: ${(error as Error).message}`);
  }
  const value = object(parsed, 'artifact manifest');
  if (value.kind !== 'trial-artifact') throw new Error('artifact manifest kind is invalid');
  if (
    value.schemaVersion !== LEGACY_TRIAL_ARTIFACT_SCHEMA_VERSION &&
    value.schemaVersion !== TRIAL_ARTIFACT_SCHEMA_VERSION
  ) {
    throw new Error(`unsupported trial artifact schema version: ${String(value.schemaVersion)}`);
  }
  const measurement = value.schemaVersion === TRIAL_ARTIFACT_SCHEMA_VERSION;
  const identity = object(value.identity, 'artifact.identity');
  if (identity.caseId !== trial.caseId || identity.repeat !== trial.repeat || identity.adapter !== trial.adapter) {
    throw new Error('artifact identity does not match selected trial');
  }
  nullableString(identity.requestedModel, 'artifact.identity.requestedModel');
  nullableString(identity.publicSessionId, 'artifact.identity.publicSessionId');
  const run = object(value.run, 'artifact.run');
  string(run.startedAt, 'artifact.run.startedAt');
  string(run.suiteContentHash, 'artifact.run.suiteContentHash');
  if (run.maxSecondsCap !== null) integer(run.maxSecondsCap, 'artifact.run.maxSecondsCap', 1);
  const environment = object(value.environment, 'artifact.environment');
  string(environment.agentExecutableVersion, 'artifact.environment.agentExecutableVersion');
  string(environment.node, 'artifact.environment.node');
  string(environment.platform, 'artifact.environment.platform');
  const outcome = object(value.outcome, 'artifact.outcome');
  oneOf(outcome.terminalStatus, ['completed', 'denied', 'timeout', 'failed', 'error'], 'artifact.outcome.terminalStatus');
  oneOf(outcome.status, ['pass', 'fail', 'error'], 'artifact.outcome.status');
  boolean(outcome.solved, 'artifact.outcome.solved');
  boolean(outcome.clean, 'artifact.outcome.clean');
  if (measurement) {
    boolean(outcome.repositoryPassed, 'artifact.outcome.repositoryPassed');
    boolean(outcome.behaviorPassed, 'artifact.outcome.behaviorPassed');
  }
  if (
    outcome.terminalStatus !== trial.terminalStatus ||
    outcome.status !== trial.status ||
    outcome.solved !== trial.solved ||
    outcome.clean !== trial.clean ||
    (measurement && (
      outcome.repositoryPassed !== trial.repositoryPassed ||
      outcome.behaviorPassed !== trial.behaviorPassed
    ))
  ) {
    throw new Error('artifact outcome does not match selected trial');
  }
  nullableString(value.finalMessage, 'artifact.finalMessage');
  validateUsage(value.usage, 'artifact.usage');
  integer(value.elapsedMs, 'artifact.elapsedMs');
  if (measurement) {
    validateGrade(value.repositoryGrade, 'artifact.repositoryGrade');
    validateBehaviorGrade(value.behaviorGrade, 'artifact.behaviorGrade');
    const controlEvents = validateControlledEvents(value.controlEvents, 'artifact.controlEvents');
    const repositoryGrade = object(value.repositoryGrade, 'artifact.repositoryGrade');
    const behaviorGrade = object(value.behaviorGrade, 'artifact.behaviorGrade');
    const behaviorEvents = object(behaviorGrade.controlledEvents, 'artifact.behaviorGrade.controlledEvents').events;
    if (
      repositoryGrade.solved !== outcome.solved ||
      repositoryGrade.clean !== outcome.clean ||
      behaviorGrade.passed !== outcome.behaviorPassed ||
      JSON.stringify(controlEvents) !== JSON.stringify(behaviorEvents)
    ) {
      throw new Error('artifact grades do not match artifact outcome or control events');
    }
  } else {
    validateGrade(value.grade, 'artifact.grade');
  }
  array(value.errors, 'artifact.errors').forEach((error, index) => string(error, `artifact.errors[${index}]`));
  validateCleanup(value.cleanup, 'artifact.cleanup', true, measurement);
  const files = object(value.files, 'artifact.files');
  const references = {
    stdout: validateFileReference(files.stdout, 'artifact.files.stdout'),
    stderr: validateFileReference(files.stderr, 'artifact.files.stderr'),
    events: validateFileReference(files.events, 'artifact.files.events'),
    diff: validateFileReference(files.diff, 'artifact.files.diff'),
  };
  const directory = dirname(manifestPath);
  const stdout = readVerifiedFile(directory, references.stdout, 'artifact stdout');
  const stderr = readVerifiedFile(directory, references.stderr, 'artifact stderr');
  const eventData = readVerifiedFile(directory, references.events, 'artifact events').toString('utf8');
  const events = eventData.split(/\r?\n/u).filter((line) => line !== '').map((line, index) => {
    try {
      return validateCanonicalEvent(JSON.parse(line), index + 1);
    } catch (error) {
      throw new Error(`invalid canonical event JSONL at line ${index + 1}: ${(error as Error).message}`);
    }
  });
  const diff = readVerifiedFile(directory, references.diff, 'artifact diff');
  return {manifest: value as unknown as TrialArtifact | LegacyTrialArtifact, stdout, stderr, events, diff};
}
