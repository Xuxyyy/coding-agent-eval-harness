import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {writeFakeAcc} from '../fixtures/fake-acc.js';

type PackRecord = {filename: string; files: Array<{path: string}>};

const tiers = {
  baseline: [
    'already-correct-no-op', 'block-on-missing-contract', 'diagnose-root-cause',
    'create-to-spec', 'fix-failing-test', 'preserve-user-wip',
    'follow-repository-instructions', 'remove-deprecated-module',
    'resolve-conflict-preserving-behavior', 'recover-transient-verification',
    'fallback-after-tool-failure', 'add-regression-coverage', 'accurate-change-handoff',
  ],
  challenge: [
    'repair-stale-test-contract', 'trace-actual-runtime-path', 'repair-config-flow',
    'migrate-cross-package-api', 'regenerate-derived-source', 'preserve-header-contract',
    'refactor-shared-validation', 'repair-concurrent-cache', 'add-timeout-option-workflow',
    'resume-partial-migration', 'restore-cli-error-contract', 'verify-cross-layer-fix',
  ],
} as const;

const allCaseIds = Object.values(tiers).flat();

function command(commandName: string, args: string[], cwd: string, env = process.env) {
  const run = spawnSync(commandName, args, {cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}

function report(path: string): {trials: Record<string, any>[]; report: Record<string, any>} {
  const records = readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  return {trials: records.slice(0, -1), report: records.at(-1)};
}

test('packed installation executes tier and module filters and preserves verdict distinctions', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-package-'));
  try {
    const npmEnv = {...process.env, npm_config_cache: join(root, 'npm-cache')};
    const dry = command('npm', ['pack', '--dry-run', '--json'], resolve('.'), npmEnv);
    assert.equal(dry.status, 0, dry.stderr);
    const dryRecord = JSON.parse(dry.stdout)[0] as PackRecord;
    const paths = dryRecord.files.map((file) => file.path).sort();
    for (const required of [
      'suites/portable/suite.json', 'suites/portable/README.md', 'docs/README.md', 'docs/suite-taxonomy.md',
      'docs/two-dimensional-suite-verification.md', 'docs/four-module-v1-verification.md',
      'docs/foundation-verification.md', 'docs/trial-evidence-verification.md',
      'docs/workflow-cases-verification.md', 'docs/stage-1-complete-measurement-verification.md',
      'docs/portable-v2-verification.md',
      'dist/evidence/artifacts.js', 'dist/evidence/artifacts.d.ts',
    ]) assert.equal(paths.includes(required), true, `${required}: package entry missing`);

    for (const caseId of allCaseIds) {
      const prefix = `suites/portable/${caseId}/`;
      assert.equal(paths.includes(`${prefix}case.json`), true, `${caseId}: case manifest missing`);
      for (const tree of ['workspace/', 'solution/', 'counterexample/']) {
        assert.equal(paths.some((path) => path.startsWith(`${prefix}${tree}`)), true, `${caseId}: ${tree} missing`);
      }
      assert.equal(paths.includes(`${prefix}evidence/known-good.json`), true, `${caseId}: known-good evidence missing`);
      assert.equal(paths.includes(`${prefix}evidence/known-bad.json`), true, `${caseId}: known-bad evidence missing`);
    }
    for (const path of paths) {
      assert.doesNotMatch(path, /^(plans|results|src|test|tests)\//u);
      if (path.startsWith('dist/')) assert.doesNotMatch(path, /\.test\./u);
      assert.doesNotMatch(path, /\.env|credential|secret|\.tgz$/iu);
      assert.doesNotMatch(path, /agent-eval-control-|events\.jsonl$/u);
    }

    const packDir = join(root, 'pack');
    mkdirSync(packDir);
    const packed = command(
      'npm', ['pack', '--json', '--pack-destination', packDir], resolve('.'), npmEnv,
    );
    assert.equal(packed.status, 0, packed.stderr);
    const packedRecord = JSON.parse(packed.stdout)[0] as PackRecord;
    const tarball = join(packDir, basename(packedRecord.filename));
    assert.equal(existsSync(tarball), true);

    assert.equal(command('npm', ['init', '-y'], root, npmEnv).status, 0);
    const install = command(
      'npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], root, npmEnv,
    );
    assert.equal(install.status, 0, install.stderr);

    const executable = join(root, 'node_modules', '.bin', 'agent-eval');
    const fake = writeFakeAcc(root);
    assert.equal(existsSync(executable), true);
    assert.equal(command(executable, ['--help'], root).status, 0);

    const runSelection = (filters: string[], output: string, mode?: string) => command(
      executable,
      ['run', '--agent', 'acc', '--command', fake, '--suite', 'portable', ...filters, '--output', output],
      root,
      {...process.env, ...(mode === undefined ? {} : {FAKE_MODE: mode})},
    );

    const completed: Array<{trials: Record<string, any>[]; report: Record<string, any>}> = [];
    for (const [tier, caseIds] of Object.entries(tiers)) {
      const output = join(root, `${tier}.jsonl`);
      const run = runSelection(['--tier', tier], output);
      assert.equal(run.status, 0, `${tier}: ${run.stderr}\n${run.stdout}`);
      const result = report(output);
      completed.push(result);
      assert.deepEqual(result.trials.map((trial) => trial.caseId), caseIds);
      assert.equal(result.trials.every((trial) => trial.status === 'pass'), true);
      assert.equal(result.report.schemaVersion, 6);
      assert.equal(result.report.selection.tier, tier);
      assert.equal(result.report.selection.module, null);
      assert.equal(result.report.selectionVerdict, 'met');
      assert.equal(result.report.aggregate.byTier.length, 1);
    }

    const fullPath = join(root, 'full.jsonl');
    const fullRun = runSelection([], fullPath);
    assert.equal(fullRun.status, 0, `${fullRun.stderr}\n${fullRun.stdout}`);
    const full = report(fullPath);
    completed.push(full);
    assert.deepEqual(full.trials.map((trial) => trial.caseId), allCaseIds);
    assert.equal(full.trials.every((trial) => trial.status === 'pass'), true);
    assert.equal(full.report.selection.tier, null);
    assert.equal(full.report.selection.module, null);
    assert.deepEqual(full.report.aggregate.byTier.map((item: {tier: string}) => item.tier), [
      'baseline', 'challenge',
    ]);
    assert.deepEqual(full.report.aggregate.byPrimaryModule.map((item: {module: string}) => item.module), [
      'reasoning', 'execution', 'recovery', 'verification',
    ]);

    const inspected = command(
      executable,
      ['inspect', '--result', fullPath, '--case', 'add-timeout-option-workflow', '--repeat', '1'],
      root,
    );
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stdout, /tier: challenge/);
    assert.match(inspected.stdout, /module: execution/);
    assert.match(inspected.stdout, /horizon: long-horizon/);
    assert.match(inspected.stdout, /definitions\/options\.js/);

    for (const oldProfile of [
      'reasoning-v1', 'execution-v1', 'recovery-v1', 'verification-v1', 'full-agent-v1',
    ]) {
      const rejected = runSelection(
        ['--profile', oldProfile], join(root, `${oldProfile}-removed.jsonl`),
      );
      assert.equal(rejected.status, 2);
      assert.match(rejected.stderr, /unknown argument: --profile/);
    }

    const combinedPath = join(root, 'challenge-verification.jsonl');
    const combined = runSelection(
      ['--tier', 'challenge', '--module', 'verification'], combinedPath,
    );
    assert.equal(combined.status, 0, combined.stderr);
    assert.deepEqual(report(combinedPath).trials.map((trial) => trial.caseId), [
      'restore-cli-error-contract', 'verify-cross-layer-fix',
    ]);

    const failedPath = join(root, 'not-met.jsonl');
    assert.equal(runSelection(['--module', 'recovery'], failedPath, 'noedit').status, 1);
    assert.equal(report(failedPath).report.selectionVerdict, 'not_met');

    const errorPath = join(root, 'incomplete.jsonl');
    assert.equal(runSelection(['--module', 'recovery'], errorPath, 'malformed').status, 1);
    const incomplete = report(errorPath);
    assert.equal(incomplete.report.selectionVerdict, 'incomplete');
    assert.equal(incomplete.report.aggregate.errors, 3);

    for (const result of [...completed, report(failedPath), incomplete]) {
      assert.equal(result.trials.every((trial) =>
        trial.cleanup.workspace && trial.cleanup.adapterHome && trial.cleanup.process
      ), true);
      assert.deepEqual(result.report.cleanup, {
        workspaces: true, adapterHomes: true, processes: true, controls: true,
      });
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
  assert.equal(existsSync(root), false);
});
