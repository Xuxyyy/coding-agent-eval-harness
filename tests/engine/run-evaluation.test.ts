import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import type {AgentAdapter} from '../../src/adapters/registry.js';
import {writeFixtureFile} from '../../src/environments/fixture.js';
import {runEvaluation, suiteContentHash} from '../../src/engine/run-evaluation.js';
import {loadCases} from '../../src/suites/cases.js';
import {readTrialArtifact} from '../../src/evidence/artifacts.js';

const solvingAdapter: AgentAdapter = {
  id: 'acc',
  async version() {
    return 'fake 1.0';
  },
  async run(invocation) {
    let finalMessage: string;
    if (existsSync(join(invocation.cwd, 'README.md'))) {
      writeFixtureFile(
        invocation.cwd,
        'src/slugify.js',
        "export function slugify(text){return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}\n",
      );
      finalMessage = 'Implemented slugify.';
    } else if (existsSync(join(invocation.cwd, 'src/sum.js'))) {
      writeFixtureFile(
        invocation.cwd,
        'src/sum.js',
        "export function sum(numbers){return numbers.reduce((total,value)=>total+value,0)}\n",
      );
      finalMessage = 'Fixed src/sum.js.';
    } else {
      writeFixtureFile(
        invocation.cwd,
        'src/token-preview.js',
        "export function tokenPreview(value){if(value.length<=8)return value;return `${value.slice(0,4)}...${value.slice(-4)}`}\n",
      );
      finalMessage = 'Fixed token-preview and preserved the draft unchanged.';
    }
    return {
      terminalStatus: 'completed',
      finalMessage,
      usage: {inputTokens: 1, outputTokens: 2, totalTokens: 3},
      events: [
        {sequence: 1, kind: 'assistant_message', providerEventType: 'text_delta', text: finalMessage},
        {sequence: 2, kind: 'terminal', providerEventType: 'result', status: 'completed', message: null},
      ],
      publicSessionId: null,
      elapsedMs: 4,
      exitCode: 0,
      signal: null,
      stdout: '{"kind":"result","stopped":"done"}\n',
      stderr: 'public warning\n',
      truncated: {stdout: false, stderr: false},
      cleanup: {adapterHome: true, process: true},
    };
  },
};

test('runEvaluation persists repeats, aggregation, metadata, raw output, and cleanup', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-runner-'));
  const progress: string[] = [];
  try {
    const output = join(root, 'result.jsonl');
    const result = await runEvaluation({
      agent: 'acc',
      command: 'fake',
      casesDir: resolve('suites/portable'),
      caseIds: ['fix-failing-test'],
      repeats: 2,
      model: 'exact-model',
      output,
      adapter: solvingAdapter,
      onProgress(event) {
        progress.push(
          event.kind === 'run-start'
            ? `${event.kind}:${event.total}`
            : `${event.kind}:${event.completed}`,
        );
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.trials.length, 2);
    assert.equal(result.report.agentExecutableVersion, 'fake 1.0');
    assert.equal(result.report.schemaVersion, 5);
    assert.equal(result.report.artifactSchemaVersion, 2);
    assert.equal(result.report.requestedModel, 'exact-model');
    assert.equal(result.report.aggregate.passes.count, 2);
    assert.equal(result.report.suiteContentHash.length, 64);
    assert.deepEqual(result.report.cleanup, {
      workspaces: true,
      adapterHomes: true,
      processes: true,
      controls: true,
    });
    const lines = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(lines.length, 3);
    assert.equal(lines.at(-1).kind, 'report');
    for (const trial of result.trials) {
      assert.equal(trial.status, 'pass');
      assert.equal(trial.cleanup.workspace, true);
      assert.notEqual(trial.rawResultPath, null);
      assert.equal(existsSync(join(root, trial.rawResultPath!)), true);
      assert.notEqual(trial.artifactManifestPath, null);
      const evidence = readTrialArtifact(output, trial as unknown as Record<string, unknown>);
      assert.equal(evidence.stdout.toString(), '{"kind":"result","stopped":"done"}\n');
      assert.equal(evidence.stderr.toString(), 'public warning\n');
      assert.match(evidence.diff.toString(), /src\/sum\.js/);
      assert.equal(evidence.manifest.cleanup.workspace, true);
    }
    assert.notEqual(result.trials[0]!.artifactManifestPath, result.trials[1]!.artifactManifestPath);
    assert.deepEqual(progress, [
      'run-start:2',
      'trial-start:0',
      'trial-complete:1',
      'trial-start:1',
      'trial-complete:2',
    ]);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runEvaluation records evidence persistence failures and still removes the workspace', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-runner-persist-fail-'));
  let workspace = '';
  try {
    const result = await runEvaluation({
      agent: 'acc',
      command: 'fake',
      casesDir: resolve('suites/portable'),
      caseIds: ['already-correct-no-op'],
      output: join(root, 'result.jsonl'),
      adapter: {
        id: 'acc',
        async version() { return 'fake failure'; },
        async run(invocation) {
          workspace = invocation.cwd;
          return {
            terminalStatus: 'completed', finalMessage: 'no change needed', usage: null,
            events: [{sequence: 1, kind: 'terminal', providerEventType: 'result', status: 'completed', message: null}],
            publicSessionId: null, elapsedMs: 1, exitCode: 0, signal: null,
            stdout: 'result\n', stderr: '', truncated: {stdout: false, stderr: false},
            cleanup: {adapterHome: true, process: true},
          };
        },
      },
      artifactWriter() {
        throw new Error('simulated storage failure');
      },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.trials[0]!.status, 'error');
    assert.match(result.trials[0]!.error ?? '', /evidence persistence failed/);
    assert.equal(result.trials[0]!.artifactManifestPath, null);
    assert.equal(result.trials[0]!.cleanup.workspace, true);
    assert.equal(existsSync(workspace), false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runner artifact and grade agree on added, modified, and deleted files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-runner-changes-'));
  try {
    const caseRoot = join(root, 'changes');
    for (const child of ['workspace', 'solution', 'counterexample']) {
      mkdirSync(join(caseRoot, child), {recursive: true});
    }
    writeFileSync(join(caseRoot, 'workspace', 'changed.txt'), 'before\n');
    writeFileSync(join(caseRoot, 'workspace', 'gone.txt'), 'remove me\n');
    writeFileSync(join(caseRoot, 'solution', 'changed.txt'), 'after\n');
    writeFileSync(join(caseRoot, 'solution', 'added.bin'), Buffer.from([0, 1, 2]));
    writeFileSync(join(caseRoot, 'solution', '.delete'), 'gone.txt\n');
    writeFileSync(join(caseRoot, 'counterexample', '.empty-overlay'), '');
    writeFileSync(join(caseRoot, 'case.json'), JSON.stringify({
      schemaVersion: 2,
      id: 'changes',
      level: 'focused',
      primaryQuality: 'change-discipline',
      supportingQualities: [],
      startState: 'unsolved',
      task: {prompt: 'Apply all requested file changes.', maxSeconds: 10},
      grade: {
        allowedWrites: ['added.bin', 'changed.txt', 'gone.txt'],
        checks: [
          {kind: 'contains', path: 'changed.txt', text: 'after'},
          {kind: 'exists', path: 'added.bin'},
          {kind: 'absent', path: 'gone.txt'},
        ],
      },
    }));
    const output = join(root, 'changes.jsonl');
    const result = await runEvaluation({
      agent: 'acc', command: 'fake', casesDir: root, output,
      adapter: {
        id: 'acc',
        async version() { return 'fake changes'; },
        async run(invocation) {
          writeFileSync(join(invocation.cwd, 'changed.txt'), 'after\n');
          writeFileSync(join(invocation.cwd, 'added.bin'), Buffer.from([0, 1, 2]));
          unlinkSync(join(invocation.cwd, 'gone.txt'));
          return {
            terminalStatus: 'completed', finalMessage: 'done', usage: null,
            events: [{sequence: 1, kind: 'terminal', providerEventType: 'result', status: 'completed', message: null}],
            publicSessionId: null, elapsedMs: 1, exitCode: 0, signal: null,
            stdout: 'done\n', stderr: '', truncated: {stdout: false, stderr: false},
            cleanup: {adapterHome: true, process: true},
          };
        },
      },
    });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.trials[0]!.changes, {
      added: ['added.bin'], modified: ['changed.txt'], deleted: ['gone.txt'],
    });
    const patch = readTrialArtifact(output, result.trials[0] as unknown as Record<string, unknown>).diff.toString();
    for (const path of ['added.bin', 'changed.txt', 'gone.txt']) assert.match(patch, new RegExp(path));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('suiteContentHash is stable and changes with suite content', () => {
  const cases = loadCases(resolve('suites/portable'));
  const first = suiteContentHash(cases);
  assert.equal(suiteContentHash([...cases].reverse()), first);
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-hash-'));
  try {
    const file = join(root, 'marker');
    writeFileSync(file, 'one');
    const synthetic = {...cases[0]!, id: 'synthetic', dir: root};
    const one = suiteContentHash([synthetic]);
    writeFileSync(file, 'two');
    assert.notEqual(suiteContentHash([synthetic]), one);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runEvaluation rejects profile overrides and unknown profiles', async () => {
  const base = {
    agent: 'acc' as const,
    command: 'fake',
    casesDir: resolve('suites/portable'),
    adapter: solvingAdapter,
  };
  await assert.rejects(
    runEvaluation({...base, profile: 'reasoning-v1', repeats: 1}),
    /cannot be combined/,
  );
  await assert.rejects(
    runEvaluation({...base, profile: 'missing-v1'}),
    /unknown profile/,
  );
});

test('runEvaluation preserves ad hoc version 1 case execution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-legacy-runner-'));
  try {
    const caseDir = join(root, 'legacy-case');
    for (const child of ['workspace', 'solution', 'counterexample']) {
      mkdirSync(join(caseDir, child), {recursive: true});
    }
    writeFileSync(join(caseDir, 'workspace', 'kept.txt'), 'same');
    writeFileSync(join(caseDir, 'case.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'legacy-case',
      category: 'edit',
      task: {prompt: 'Keep the solved fixture unchanged.', maxSeconds: 10},
      grade: {
        allowedWrites: [],
        checks: [
          {kind: 'exists', path: 'kept.txt'},
          {kind: 'unchanged', path: 'kept.txt'},
        ],
      },
    }));
    const result = await runEvaluation({
      agent: 'acc',
      command: 'fake',
      casesDir: root,
      output: join(root, 'legacy.jsonl'),
      adapter: {
        id: 'acc',
        async version() { return 'fake legacy'; },
        async run() {
          return {
            terminalStatus: 'completed', finalMessage: 'done', usage: null, elapsedMs: 1,
            events: [{sequence: 1, kind: 'terminal', providerEventType: 'result', status: 'completed', message: null}],
            publicSessionId: null,
            exitCode: 0, signal: null, stdout: '{"kind":"result"}\n', stderr: '',
            truncated: {stdout: false, stderr: false},
            cleanup: {adapterHome: true, process: true},
          };
        },
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.report.profile, null);
    assert.equal(result.report.profileVerdict, null);
    assert.equal(result.trials[0]!.level, null);
    assert.equal(result.trials[0]!.primaryQuality, null);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
