import {resolve} from 'node:path';
import {
  INSPECT_SECTION_LIMIT,
  readResultFile,
  readTrialArtifact,
} from '../evidence/artifacts.js';
import {LEGACY_REPORT_SCHEMA_VERSION, TRIAL_ARTIFACT_SCHEMA_VERSION} from '../types/index.js';

export type InspectOptions = {result: string; caseId: string; repeat: number};

function bounded(value: string): string {
  if (Buffer.byteLength(value) <= INSPECT_SECTION_LIMIT) return value;
  let kept = value.slice(0, INSPECT_SECTION_LIMIT);
  while (Buffer.byteLength(kept) > INSPECT_SECTION_LIMIT) kept = kept.slice(0, -1);
  return `${kept}\n… [section truncated]`;
}

export function inspectResult(options: InspectOptions): string {
  const resultPath = resolve(options.result);
  const result = readResultFile(resultPath);
  const matches = result.trials.filter(
    (trial) => trial.caseId === options.caseId && trial.repeat === options.repeat,
  );
  if (matches.length === 0) {
    throw new Error(`no trial matches case ${JSON.stringify(options.caseId)} repeat ${options.repeat}`);
  }
  if (matches.length !== 1) {
    throw new Error(`multiple trials match case ${JSON.stringify(options.caseId)} repeat ${options.repeat}`);
  }
  const trial = matches[0]!;
  const identity = [
    `case: ${String(trial.caseId)}`,
    `repeat: ${String(trial.repeat)}`,
    `adapter: ${String(trial.adapter ?? result.report.requestedAdapter ?? 'unknown')}`,
    `status: ${String(trial.status ?? 'unknown')}`,
    `terminal: ${String(trial.terminalStatus ?? 'unknown')}`,
    `module: ${String(trial.primaryModule ?? 'unknown')}`,
    `horizon: ${String(trial.horizon ?? 'unknown')}`,
    `primary quality: ${String(trial.primaryQuality ?? 'unknown')}`,
    `solved: ${String(trial.solved ?? 'unknown')}`,
    `clean: ${String(trial.clean ?? 'unknown')}`,
    `expected disposition: ${String(trial.expectedDisposition ?? 'unknown')}`,
  ];
  if (result.schemaVersion === LEGACY_REPORT_SCHEMA_VERSION) {
    return [
      'Identity and status',
      ...identity,
      '',
      'Structured evidence',
      'This is a report schema version 2 result. Structured trial artifacts are unavailable.',
    ].join('\n');
  }

  const evidence = readTrialArtifact(resultPath, trial);
  const manifest = evidence.manifest;
  const measurement = manifest.schemaVersion === TRIAL_ARTIFACT_SCHEMA_VERSION;
  const repositoryGrade = measurement ? manifest.repositoryGrade : manifest.grade;
  const events = evidence.events.map((event) => {
    const detail = event.kind === 'assistant_message'
      ? ` ${JSON.stringify(event.text)}`
      : event.kind === 'terminal'
        ? ` status=${event.status}${event.message === null ? '' : ` message=${JSON.stringify(event.message)}`}`
        : event.kind === 'tool_call' || event.kind === 'tool_result'
          ? ` tool=${event.toolName ?? 'unknown'} id=${event.toolCallId ?? 'unknown'}`
          : event.kind === 'usage'
            ? ` ${JSON.stringify(event.usage)}`
            : '';
    return `${event.sequence}. ${event.kind} [${event.providerEventType}]${detail}`;
  });
  const changeLines = [
    `added: ${repositoryGrade.changes.added.join(', ') || '(none)'}`,
    `modified: ${repositoryGrade.changes.modified.join(', ') || '(none)'}`,
    `deleted: ${repositoryGrade.changes.deleted.join(', ') || '(none)'}`,
    `scope violations: ${repositoryGrade.scopeViolations.join(', ') || '(none)'}`,
  ];
  const checkLines = repositoryGrade.checks.map(
    (check, index) => `${index + 1}. ${check.ok ? 'PASS' : 'FAIL'} ${check.detail}`,
  );
  const behaviorLines = measurement
    ? [
      `passed: ${manifest.behaviorGrade.passed}`,
      `disposition: ${manifest.behaviorGrade.expectedDisposition ?? '(legacy)'} (${manifest.behaviorGrade.dispositionPassed ? 'PASS' : 'FAIL'})`,
      `final response: ${manifest.behaviorGrade.finalResponse.passed ? 'PASS' : 'FAIL'}`,
      ...manifest.behaviorGrade.finalResponse.checks.map(
        (check, index) => `${index + 1}. ${check.ok ? 'PASS' : 'FAIL'} ${check.detail}`,
      ),
      `controlled events: ${manifest.behaviorGrade.controlledEvents.passed ? 'PASS' : 'FAIL'}`,
      ...manifest.behaviorGrade.controlledEvents.checks.map(
        (check, index) => `${index + 1}. ${check.ok ? 'PASS' : 'FAIL'} ${check.detail}`,
      ),
      ...manifest.controlEvents.map(
        (event) => `${event.sequence}. ${event.probeId}: ${event.outcome}`,
      ),
    ]
    : ['Unavailable in artifact schema version 1.'];
  const trialErrors = typeof trial.error === 'string' ? [trial.error] : [];
  const errors = [...manifest.errors, ...trialErrors].filter((item, index, all) => all.indexOf(item) === index);
  const artifactDirectory = trial.artifactManifestPath === null
    ? '(unavailable)'
    : String(trial.artifactManifestPath).replace(/\/manifest\.json$/u, '');
  return [
    'Identity and status',
    ...identity,
    `agent version: ${manifest.environment.agentExecutableVersion}`,
    `public session: ${manifest.identity.publicSessionId ?? '(none)'}`,
    '',
    'Final message',
    bounded(manifest.finalMessage ?? '(none)'),
    '',
    'Events',
    bounded(events.join('\n') || '(none)'),
    '',
    'Git diff',
    bounded(evidence.diff.toString('utf8') || '(empty)'),
    manifest.files.diff.truncated ? '[diff capture truncated]' : '',
    '',
    'Repository outcome',
    `passed: ${measurement ? manifest.outcome.repositoryPassed : repositoryGrade.solved && repositoryGrade.clean}`,
    `solved: ${repositoryGrade.solved}`,
    `clean: ${repositoryGrade.clean}`,
    ...changeLines,
    'repository checks:',
    bounded(checkLines.join('\n') || '(none)'),
    '',
    'Trial behavior',
    bounded(behaviorLines.join('\n')),
    '',
    'Errors',
    bounded(errors.join('\n') || '(none)'),
    '',
    'Cleanup',
    `workspace: ${manifest.cleanup.workspace}`,
    `adapter home: ${manifest.cleanup.adapterHome}`,
    `process: ${manifest.cleanup.process}`,
    `control: ${measurement ? manifest.cleanup.control : '(legacy)'}`,
    '',
    'Artifacts',
    `manifest: ${String(trial.artifactManifestPath)}`,
    `directory: ${artifactDirectory}`,
    `stdout: ${manifest.files.stdout.path} (${manifest.files.stdout.bytes} bytes${manifest.files.stdout.truncated ? ', truncated' : ''})`,
    `stderr: ${manifest.files.stderr.path} (${manifest.files.stderr.bytes} bytes${manifest.files.stderr.truncated ? ', truncated' : ''})`,
    `events: ${manifest.files.events.path} (${manifest.files.events.bytes} bytes)`,
    `diff: ${manifest.files.diff.path} (${manifest.files.diff.bytes} bytes${manifest.files.diff.truncated ? ', truncated' : ''})`,
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
}
