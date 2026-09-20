import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {writeFakeAcc} from '../fixtures/fake-acc.js';

type PackRecord = {filename: string; files: Array<{path: string}>};

const profiles = {
  'reasoning-v1': [
    'already-correct-no-op', 'block-on-missing-contract', 'diagnose-root-cause',
    'repair-stale-test-contract', 'trace-actual-runtime-path', 'repair-config-flow',
    'migrate-cross-package-api',
  ],
  'execution-v1': [
    'create-to-spec', 'fix-failing-test', 'preserve-user-wip',
    'follow-repository-instructions', 'remove-deprecated-module',
    'resolve-conflict-preserving-behavior', 'regenerate-derived-source',
    'preserve-header-contract', 'refactor-shared-validation',
    'repair-concurrent-cache', 'add-timeout-option-workflow',
  ],
  'recovery-v1': [
    'recover-transient-verification', 'fallback-after-tool-failure', 'resume-partial-migration',
  ],
  'verification-v1': [
    'add-regression-coverage', 'accurate-change-handoff',
    'restore-cli-error-contract', 'verify-cross-layer-fix',
  ],
} as const;

const allCaseIds = Object.values(profiles).flat();

function command(commandName: string, args: string[], cwd: string, env = process.env) {
  const run = spawnSync(commandName, args, {cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}

function report(path: string): {trials: Record<string, any>[]; report: Record<string, any>} {
  const records = readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  return {trials: records.slice(0, -1), report: records.at(-1)};
}

test('packed installation executes four-module profiles and preserves verdict distinctions', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-package-'));
  try {
    const dry = command('npm', ['pack', '--dry-run', '--json'], resolve('.'));
    assert.equal(dry.status, 0, dry.stderr);
    const dryRecord = JSON.parse(dry.stdout)[0] as PackRecord;
    const paths = dryRecord.files.map((file) => file.path).sort();
    for (const required of [
      'suites/portable/suite.json', 'suites/portable/README.md', 'docs/suite-taxonomy.md',
      'docs/four-module-v1-verification.md',
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
    const packed = command('npm', ['pack', '--json', '--pack-destination', packDir], resolve('.'));
    assert.equal(packed.status, 0, packed.stderr);
    const packedRecord = JSON.parse(packed.stdout)[0] as PackRecord;
    const tarball = join(packDir, basename(packedRecord.filename));
    assert.equal(existsSync(tarball), true);

    assert.equal(command('npm', ['init', '-y'], root).status, 0);
    const install = command(
      'npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], root,
    );
    assert.equal(install.status, 0, install.stderr);

    const packageRoot = join(root, 'node_modules', 'agent-eval-harness');
    const executable = join(root, 'node_modules', '.bin', 'agent-eval');
    const cases = join(packageRoot, 'suites', 'portable');
    const fake = writeFakeAcc(root);
    assert.equal(existsSync(executable), true);
    assert.equal(command(executable, ['--help'], root).status, 0);

    const runProfile = (profileId: string, output: string, mode?: string) => command(
      executable,
      ['run', '--agent', 'acc', '--command', fake, '--cases', cases, '--profile', profileId, '--output', output],
      root,
      {...process.env, ...(mode === undefined ? {} : {FAKE_MODE: mode})},
    );

    const completed: Array<{trials: Record<string, any>[]; report: Record<string, any>}> = [];
    for (const [profileId, caseIds] of Object.entries(profiles)) {
      const output = join(root, `${profileId}.jsonl`);
      const run = runProfile(profileId, output);
      assert.equal(run.status, 0, `${profileId}: ${run.stderr}\n${run.stdout}`);
      const result = report(output);
      completed.push(result);
      assert.deepEqual(result.trials.map((trial) => trial.caseId), caseIds);
      assert.equal(result.trials.every((trial) => trial.status === 'pass'), true);
      assert.equal(result.report.schemaVersion, 5);
      assert.equal(result.report.profile.profileId, profileId);
      assert.equal(result.report.profile.module, profileId.replace('-v1', ''));
      assert.equal(result.report.profileVerdict, 'met');
      assert.equal(result.report.aggregate.byPrimaryModule.length, 1);
    }

    const fullPath = join(root, 'full-agent-v1.jsonl');
    const fullRun = runProfile('full-agent-v1', fullPath);
    assert.equal(fullRun.status, 0, `${fullRun.stderr}\n${fullRun.stdout}`);
    const full = report(fullPath);
    completed.push(full);
    assert.deepEqual(full.trials.map((trial) => trial.caseId), allCaseIds);
    assert.equal(full.trials.every((trial) => trial.status === 'pass'), true);
    assert.equal(full.report.profile.module, 'all');
    assert.deepEqual(full.report.aggregate.byPrimaryModule.map((item: {module: string}) => item.module), [
      'reasoning', 'execution', 'recovery', 'verification',
    ]);

    const inspected = command(
      executable,
      ['inspect', '--result', fullPath, '--case', 'add-timeout-option-workflow', '--repeat', '1'],
      root,
    );
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stdout, /module: execution/);
    assert.match(inspected.stdout, /horizon: long-horizon/);
    assert.match(inspected.stdout, /definitions\/options\.js/);

    for (const oldProfile of ['smoke-v1', 'focused-v1', 'workflow-v1', 'full-v2']) {
      const rejected = runProfile(oldProfile, join(root, `${oldProfile}-removed.jsonl`));
      assert.equal(rejected.status, 2);
      assert.match(rejected.stderr, /unknown profile/);
    }

    const failedPath = join(root, 'not-met.jsonl');
    assert.equal(runProfile('recovery-v1', failedPath, 'noedit').status, 1);
    assert.equal(report(failedPath).report.profileVerdict, 'not_met');

    const errorPath = join(root, 'incomplete.jsonl');
    assert.equal(runProfile('recovery-v1', errorPath, 'malformed').status, 1);
    const incomplete = report(errorPath);
    assert.equal(incomplete.report.profileVerdict, 'incomplete');
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
