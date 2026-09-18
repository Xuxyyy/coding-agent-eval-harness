import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import test from 'node:test';
import {
  GIT_DIFF_LIMIT_BYTES,
  captureGitDiff,
  readResultFile,
  readTrialArtifact,
  safeArtifactPath,
  writeTrialArtifact,
} from '../../src/evidence/artifacts.js';
import type {AdapterResult, GradeResult, TrialRecord} from '../../src/types/index.js';

const grade: GradeResult = {
  solved: true,
  clean: true,
  checks: [],
  changes: {added: ['added.bin'], modified: ['changed.txt'], deleted: ['gone.txt']},
  scopeViolations: [],
};

function trial(overrides: Partial<TrialRecord> = {}): TrialRecord {
  return {
    kind: 'trial',
    caseId: 'case-a',
    repeat: 1,
    adapter: 'codex',
    requestedModel: null,
    level: 'focused',
    primaryQuality: 'task-effectiveness',
    supportingQualities: [],
    startState: 'unsolved',
    terminalStatus: 'completed',
    status: 'pass',
    solved: true,
    clean: true,
    elapsedMs: 12,
    usage: {inputTokens: 2, outputTokens: 1, totalTokens: 3},
    checks: [],
    changes: grade.changes,
    scopeViolations: [],
    cleanup: {workspace: true, adapterHome: true, process: true},
    rawResultPath: null,
    artifactManifestPath: null,
    ...overrides,
  };
}

function adapter(): AdapterResult {
  return {
    terminalStatus: 'completed',
    finalMessage: 'finished',
    usage: {inputTokens: 2, outputTokens: 1, totalTokens: 3},
    events: [
      {sequence: 1, kind: 'other', providerEventType: 'thread.started'},
      {sequence: 2, kind: 'assistant_message', providerEventType: 'item.completed', text: 'finished'},
      {sequence: 3, kind: 'usage', providerEventType: 'turn.completed', usage: {totalTokens: 3}},
      {sequence: 4, kind: 'terminal', providerEventType: 'terminal', status: 'completed', message: null},
    ],
    publicSessionId: 'public-thread',
    elapsedMs: 12,
    exitCode: 0,
    signal: null,
    stdout: '\ufffd',
    stderr: 'warning',
    stdoutBytes: Uint8Array.from([0xff, 0x00, 0x41]),
    stderrBytes: Buffer.from('warning'),
    truncated: {stdout: false, stderr: true},
    cleanup: {adapterHome: true, process: true},
  };
}

function reportRecord() {
  return {
    kind: 'report',
    schemaVersion: 3,
    requestedAdapter: 'codex',
    requestedModel: null,
    agentExecutableVersion: 'fake 1.0',
    startedAt: '2026-01-01T00:00:00.000Z',
    elapsedMs: 12,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    repeats: 1,
    selectedCaseIds: ['case-a'],
    profile: null,
    profileVerdict: null,
    maxSecondsCap: null,
    suiteContentHash: 'a'.repeat(64),
    artifactSchemaVersion: 1,
    artifactRoot: 'result.artifacts',
    caseSchemaVersions: {'case-a': 2},
    terminalStatus: 'completed',
    aggregate: {},
    cleanup: {workspaces: true, adapterHomes: true, processes: true},
  };
}

test('artifact writer and reader preserve bytes, canonical events, and identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-artifact-'));
  try {
    const resultPath = join(root, 'result.jsonl');
    const artifactRoot = join(root, 'result.artifacts');
    mkdirSync(artifactRoot);
    const selected = trial();
    const manifestPath = writeTrialArtifact({
      artifactRoot,
      resultPath,
      trial: selected,
      adapterResult: adapter(),
      grade,
      patch: Buffer.from('diff --git a/gone.txt b/gone.txt\n'),
      patchTruncated: false,
      run: {
        startedAt: '2026-01-01T00:00:00.000Z',
        suiteContentHash: 'a'.repeat(64),
        maxSecondsCap: null,
        agentExecutableVersion: 'fake 1.0',
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
    });
    selected.artifactManifestPath = manifestPath;
    selected.rawResultPath = join(dirname(manifestPath), 'stdout.bin');
    writeFileSync(resultPath, `${JSON.stringify(selected)}\n${JSON.stringify(reportRecord())}\n`);

    const parsed = readResultFile(resultPath);
    assert.equal(parsed.schemaVersion, 3);
    const artifact = readTrialArtifact(resultPath, parsed.trials[0]!);
    assert.deepEqual([...artifact.stdout], [0xff, 0x00, 0x41]);
    assert.equal(artifact.stderr.toString(), 'warning');
    assert.deepEqual(artifact.events.map((event) => event.kind), [
      'other', 'assistant_message', 'usage', 'terminal',
    ]);
    assert.equal(artifact.manifest.identity.publicSessionId, 'public-thread');
    assert.equal(artifact.manifest.files.stderr.truncated, true);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('result and artifact readers reject unsafe paths, versions, identity mismatches, and event gaps', () => {
  assert.throws(() => safeArtifactPath('../secret'), /normalized relative path/);
  assert.throws(() => safeArtifactPath('/absolute'), /normalized relative path/);
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-artifact-invalid-'));
  try {
    const resultPath = join(root, 'result.jsonl');
    writeFileSync(resultPath, `${JSON.stringify({...reportRecord(), schemaVersion: 99})}\n`);
    assert.throws(() => readResultFile(resultPath), /unsupported report schema/);

    const artifactRoot = join(root, 'result.artifacts');
    mkdirSync(artifactRoot);
    const selected = trial();
    selected.artifactManifestPath = writeTrialArtifact({
      artifactRoot,
      resultPath,
      trial: selected,
      adapterResult: adapter(),
      grade,
      patch: Buffer.alloc(0),
      patchTruncated: false,
      run: {
        startedAt: '2026-01-01T00:00:00.000Z',
        suiteContentHash: 'a'.repeat(64),
        maxSecondsCap: null,
        agentExecutableVersion: 'fake 1.0',
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
    });
    assert.throws(
      () => readTrialArtifact(resultPath, {...selected, caseId: 'other'}),
      /identity does not match/,
    );

    const manifestPath = join(root, selected.artifactManifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const diffPath = join(dirname(manifestPath), manifest.files.diff.path);
    const savedDiff = readFileSync(diffPath);
    rmSync(diffPath);
    assert.throws(() => readTrialArtifact(resultPath, selected), /artifact diff is missing/);
    writeFileSync(diffPath, savedDiff);
    const eventsPath = join(dirname(manifestPath), manifest.files.events.path);
    const lines = readFileSync(eventsPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    lines[1].sequence = 8;
    const changed = Buffer.from(`${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
    writeFileSync(eventsPath, changed);
    manifest.files.events.bytes = changed.byteLength;
    manifest.files.events.sha256 = createHash('sha256').update(changed).digest('hex');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => readTrialArtifact(resultPath, selected), /event sequence must be contiguous/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('version 2 result files remain readable without structured artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-result-v2-'));
  try {
    const resultPath = join(root, 'legacy.jsonl');
    writeFileSync(
      resultPath,
      `${JSON.stringify({kind: 'trial', caseId: 'legacy', repeat: 1, status: 'fail'})}\n` +
        `${JSON.stringify({kind: 'report', schemaVersion: 2})}\n`,
    );
    const parsed = readResultFile(resultPath);
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.trials.length, 1);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

function git(root: string, args: string[]): void {
  const run = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
}

test('Git evidence includes additions, modifications, deletions, binary data, and truncation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-diff-'));
  try {
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.name', 'Test']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    writeFileSync(join(root, 'changed.txt'), 'before\n');
    writeFileSync(join(root, 'gone.txt'), 'gone\n');
    git(root, ['add', '--all']);
    git(root, ['commit', '-q', '-m', 'initial']);
    writeFileSync(join(root, 'changed.txt'), 'after\n');
    rmSync(join(root, 'gone.txt'));
    writeFileSync(join(root, 'added.bin'), Buffer.from([0, 1, 2, 3]));
    const patch = await captureGitDiff(root);
    const text = patch.data.toString('utf8');
    assert.match(text, /changed\.txt/);
    assert.match(text, /gone\.txt/);
    assert.match(text, /added\.bin/);
    assert.match(text, /GIT binary patch|Binary files/u);
    assert.equal(patch.truncated, false);

    writeFileSync(join(root, 'large.txt'), 'x'.repeat(GIT_DIFF_LIMIT_BYTES + 100_000));
    const bounded = await captureGitDiff(root);
    assert.equal(bounded.data.byteLength, GIT_DIFF_LIMIT_BYTES);
    assert.equal(bounded.truncated, true);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
