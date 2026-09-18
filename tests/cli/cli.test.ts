import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {HELP, parseCliArgs} from '../../src/cli/index.js';
import {writeFakeAcc} from '../fixtures/fake-acc.js';

test('CLI parses every supported argument', () => {
  const parsed = parseCliArgs([
    'run',
    '--agent',
    'codex',
    '--command',
    '/path with spaces/codex',
    '--cases',
    'suite',
    '--case',
    'a',
    '--case',
    'b',
    '--repeats',
    '2',
    '--max-seconds',
    '30',
    '--model',
    'm',
    '--output',
    'out.jsonl',
  ]);
  assert.deepEqual(parsed, {
    help: false,
    options: {
      agent: 'codex',
      command: '/path with spaces/codex',
      casesDir: 'suite',
      caseIds: ['a', 'b'],
      repeats: 2,
      maxSeconds: 30,
      model: 'm',
      output: 'out.jsonl',
    },
  });
  assert.deepEqual(parseCliArgs(['--help']), {help: true});
  assert.deepEqual(
    parseCliArgs(['run', '--agent', 'claude', '--command', 'claude', '--cases', 'suite']),
    {
      help: false,
      options: {agent: 'claude', command: 'claude', casesDir: 'suite', repeats: 1},
    },
  );
  assert.match(HELP, /never a shell command/);
  assert.match(HELP, /--profile <id>/);
  assert.match(HELP, /agent-eval inspect/);
  assert.deepEqual(
    parseCliArgs(['inspect', '--result', 'out.jsonl', '--case', 'a', '--repeat', '2']),
    {help: false, inspect: {result: 'out.jsonl', caseId: 'a', repeat: 2}},
  );
});

test('CLI parses profiles and rejects identity-changing overrides', () => {
  assert.deepEqual(
    parseCliArgs([
      'run', '--agent', 'acc', '--command', 'fake', '--cases', 'suite', '--profile', 'smoke-v1',
    ]),
    {
      help: false,
      options: {
        agent: 'acc',
        command: 'fake',
        casesDir: 'suite',
        profile: 'smoke-v1',
      },
    },
  );
  for (const override of [['--case', 'a'], ['--repeats', '2']]) {
    assert.throws(
      () => parseCliArgs([
        'run', '--agent', 'acc', '--command', 'fake', '--cases', 'suite',
        '--profile', 'smoke-v1', ...override,
      ]),
      /cannot be combined/,
    );
  }
});

test('CLI rejects missing, unknown, and invalid arguments', () => {
  assert.throws(() => parseCliArgs(['other']), /first argument must be run/);
  assert.throws(() => parseCliArgs(['run', '--agent', 'other']), /acc, codex, or claude/);
  assert.throws(() => parseCliArgs(['run', '--agent', 'acc']), /--command is required/);
  assert.throws(
    () =>
      parseCliArgs([
        'run',
        '--agent',
        'acc',
        '--command',
        'acc',
        '--cases',
        'suite',
        '--repeats',
        '0',
      ]),
    /positive integer/,
  );
  assert.throws(
    () => parseCliArgs(['run', '--agent', 'acc', '--command', 'acc', '--cases', 'suite', '--bad']),
    /unknown argument/,
  );
});

function runCli(executable: string, output: string, mode?: string, profile?: string) {
  return spawnSync(
    process.execPath,
    [
      resolve('dist/cli/index.js'),
      'run',
      '--agent',
      'acc',
      '--command',
      executable,
      '--cases',
      resolve('suites/portable'),
      '--output',
      output,
      ...(profile === undefined ? [] : ['--profile', profile]),
    ],
    {
      encoding: 'utf8',
      env: {...process.env, ...(mode === undefined ? {} : {FAKE_MODE: mode})},
    },
  );
}

test('built CLI runs all six cases end to end and writes a parseable ad hoc report', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-'));
  try {
    const executable = writeFakeAcc(root);
    const output = join(root, 'pass.jsonl');
    const run = runCli(executable, output);
    assert.equal(run.status, 0, `${run.stderr}\n${run.stdout}`);
    assert.match(run.stdout, /terminal\s+elapsed_ms\s+total_tokens/);
    assert.match(run.stdout, /running 1\/6  add-regression-coverage \(repeat 1\)/);
    assert.match(run.stdout, /create-to-spec\s+1\s+pass/);
    assert.match(run.stdout, /create-to-spec\s+1\s+pass\s+true\s+true\s+completed\s+\d+\s+6/);
    assert.match(run.stdout, /report\s+completed\s+passes 6\/6/);
    const records = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(records.length, 7);
    assert.deepEqual(records.slice(0, 6).map((record) => record.status), Array(6).fill('pass'));
    assert.equal(records[6].schemaVersion, 3);
    assert.equal(records[6].artifactSchemaVersion, 1);
    assert.equal(records[6].profile, null);
    assert.equal(records[6].profileVerdict, null);
    assert.equal(records[6].suiteContentHash.length, 64);
    assert.deepEqual(records[6].cleanup, {
      workspaces: true,
      adapterHomes: true,
      processes: true,
    });
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

function inspectCli(output: string, caseId: string, repeat = 1) {
  return spawnSync(
    process.execPath,
    [resolve('dist/cli/index.js'), 'inspect', '--result', output, '--case', caseId, '--repeat', String(repeat)],
    {encoding: 'utf8'},
  );
}

test('built CLI runs then inspects structured evidence, including after bundle relocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-inspect-'));
  try {
    const source = join(root, 'source');
    mkdirSync(source);
    const executable = writeFakeAcc(root);
    const output = join(source, 'result.jsonl');
    const run = runCli(executable, output);
    assert.equal(run.status, 0, run.stderr);
    const inspected = inspectCli(output, 'create-to-spec');
    assert.equal(inspected.status, 0, inspected.stderr);
    for (const section of [
      'Identity and status', 'Final message', 'Events', 'Git diff', 'File changes',
      'Checks', 'Errors', 'Cleanup', 'Artifacts',
    ]) assert.match(inspected.stdout, new RegExp(section));
    assert.match(inspected.stdout, /status: pass/);
    assert.match(inspected.stdout, /src\/slugify\.js/);

    const records = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const selected = records.find((record) => record.kind === 'trial' && record.caseId === 'create-to-spec');
    const manifestPath = join(source, selected.artifactManifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const diffPath = join(join(manifestPath, '..'), manifest.files.diff.path);
    const largeDiff = Buffer.from('diff evidence\n'.repeat(2_000));
    writeFileSync(diffPath, largeDiff);
    manifest.files.diff.bytes = largeDiff.byteLength;
    manifest.files.diff.sha256 = createHash('sha256').update(largeDiff).digest('hex');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const bounded = inspectCli(output, 'create-to-spec');
    assert.equal(bounded.status, 0, bounded.stderr);
    assert.match(bounded.stdout, /section truncated/);

    const moved = join(root, 'moved');
    renameSync(source, moved);
    const movedInspect = inspectCli(join(moved, 'result.jsonl'), 'create-to-spec');
    assert.equal(movedInspect.status, 0, movedInspect.stderr);
    assert.match(movedInspect.stdout, /status: pass/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('inspect is readable for capability failures and returns 2 for selection errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-inspect-fail-'));
  try {
    const executable = writeFakeAcc(root);
    const output = join(root, 'failed.jsonl');
    const run = runCli(executable, output, 'noedit');
    assert.equal(run.status, 1);
    const inspected = inspectCli(output, 'create-to-spec');
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stdout, /status: fail/);
    const missing = inspectCli(output, 'missing-case');
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /no trial matches/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('inspect explains version 2 results and rejects duplicate or unsafe artifact selections', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-inspect-legacy-'));
  try {
    const legacy = join(root, 'legacy.jsonl');
    const oldTrial = {kind: 'trial', caseId: 'old', repeat: 1, status: 'fail'};
    writeFileSync(
      legacy,
      `${JSON.stringify(oldTrial)}\n${JSON.stringify({kind: 'report', schemaVersion: 2})}\n`,
    );
    const oldInspect = inspectCli(legacy, 'old');
    assert.equal(oldInspect.status, 0, oldInspect.stderr);
    assert.match(oldInspect.stdout, /schema version 2/);
    assert.match(oldInspect.stdout, /unavailable/);

    const duplicate = join(root, 'duplicate.jsonl');
    writeFileSync(
      duplicate,
      `${JSON.stringify(oldTrial)}\n${JSON.stringify(oldTrial)}\n` +
        `${JSON.stringify({kind: 'report', schemaVersion: 2})}\n`,
    );
    const duplicateInspect = inspectCli(duplicate, 'old');
    assert.equal(duplicateInspect.status, 2);
    assert.match(duplicateInspect.stderr, /multiple trials match/);

    const executable = writeFakeAcc(root);
    const unsafe = join(root, 'unsafe.jsonl');
    assert.equal(runCli(executable, unsafe).status, 0);
    const records = readFileSync(unsafe, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    records[0].artifactManifestPath = '../outside.json';
    writeFileSync(unsafe, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
    const unsafeInspect = inspectCli(unsafe, 'create-to-spec');
    assert.equal(unsafeInspect.status, 2);
    assert.match(unsafeInspect.stderr, /normalized relative path/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('built CLI preserves profile order and distinguishes every verdict', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-profile-'));
  try {
    const executable = writeFakeAcc(root);
    const outcomes = [
      {mode: undefined, verdict: 'met', status: 0},
      {mode: 'noedit', verdict: 'not_met', status: 1},
      {mode: 'malformed', verdict: 'incomplete', status: 1},
    ];
    for (const outcome of outcomes) {
      const output = join(root, `${outcome.verdict}.jsonl`);
      const run = runCli(executable, output, outcome.mode, 'smoke-v1');
      assert.equal(run.status, outcome.status, run.stderr);
      assert.match(run.stdout, new RegExp(`profile\\s+smoke-v1\\s+verdict ${outcome.verdict}`));
      const records = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      const report = records.at(-1);
      assert.deepEqual(
        records.slice(0, -1).map((record) => record.caseId),
        ['create-to-spec', 'already-correct-no-op', 'preserve-user-wip'],
      );
      assert.equal(report.profile.profileId, 'smoke-v1');
      assert.equal(report.profileVerdict, outcome.verdict);
      assert.deepEqual(report.selectedCaseIds, report.profile.caseIds);
      assert.deepEqual(
        report.aggregate.byCase.map((item: {complete: boolean}) => item.complete),
        [true, true, true],
      );
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('built CLI returns nonzero while preserving fail and error categories', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cli-'));
  try {
    const executable = writeFakeAcc(root);
    const failedPath = join(root, 'failed.jsonl');
    const failed = runCli(executable, failedPath, 'noedit');
    assert.equal(failed.status, 1);
    const failures = readFileSync(failedPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(failures[0].status, 'fail');
    assert.equal(failures.at(-1).terminalStatus, 'failed');

    const errorPath = join(root, 'error.jsonl');
    const errored = runCli(executable, errorPath, 'malformed');
    assert.equal(errored.status, 1);
    const errors = readFileSync(errorPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(errors[0].status, 'error');
    assert.equal(errors.at(-1).terminalStatus, 'error');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
