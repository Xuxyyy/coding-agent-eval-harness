import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {writeFakeAcc} from '../fixtures/fake-acc.js';

type PackRecord = {filename: string; files: Array<{path: string}>};

function command(command: string, args: string[], cwd: string, env = process.env) {
  const run = spawnSync(command, args, {cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}

function report(path: string): {trials: Record<string, unknown>[]; report: Record<string, any>} {
  const records = readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  return {trials: records.slice(0, -1), report: records.at(-1)};
}

test('packed installation executes both profiles and preserves verdict distinctions', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-package-'));
  try {
    const dry = command('npm', ['pack', '--dry-run', '--json'], resolve('.'));
    assert.equal(dry.status, 0, dry.stderr);
    const dryRecord = JSON.parse(dry.stdout)[0] as PackRecord;
    const paths = dryRecord.files.map((file) => file.path).sort();
    assert.equal(paths.includes('suites/portable/suite.json'), true);
    assert.equal(paths.includes('suites/portable/README.md'), true);
    assert.equal(paths.includes('dist/evidence/artifacts.js'), true);
    assert.equal(paths.includes('dist/evidence/artifacts.d.ts'), true);
    const caseIds = [
      'create-to-spec',
      'fix-failing-test',
      'preserve-user-wip',
      'already-correct-no-op',
      'follow-repository-instructions',
      'add-regression-coverage',
    ];
    for (const caseId of caseIds) {
      const prefix = `suites/portable/${caseId}/`;
      assert.equal(paths.includes(`${prefix}case.json`), true, `${caseId}: case manifest missing`);
      for (const tree of ['workspace/', 'solution/', 'counterexample/']) {
        assert.equal(
          paths.some((path) => path.startsWith(`${prefix}${tree}`)),
          true,
          `${caseId}: ${tree} missing`,
        );
      }
    }
    for (const path of paths) {
      assert.doesNotMatch(path, /^(plans|results|src|test|tests)\//u);
      if (path.startsWith('dist/')) assert.doesNotMatch(path, /\.test\./u);
      assert.doesNotMatch(path, /\.env|credential|secret|\.tgz$/iu);
    }

    const packDir = join(root, 'pack');
    mkdirSync(packDir);
    const packed = command('npm', ['pack', '--json', '--pack-destination', packDir], resolve('.'));
    assert.equal(packed.status, 0, packed.stderr);
    const packedRecord = JSON.parse(packed.stdout)[0] as PackRecord;
    const tarball = join(packDir, basename(packedRecord.filename));
    assert.equal(existsSync(tarball), true);

    const consumer = join(root, 'consumer');
    const init = command('npm', ['init', '-y'], root);
    assert.equal(init.status, 0, init.stderr);
    // npm init creates in root; use that root as the isolated consumer prefix.
    const install = command(
      'npm',
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
      root,
    );
    assert.equal(install.status, 0, install.stderr);
    assert.equal(existsSync(consumer), false);

    const packageRoot = join(root, 'node_modules', 'agent-eval-harness');
    const executable = join(root, 'node_modules', '.bin', 'agent-eval');
    const cases = join(packageRoot, 'suites', 'portable');
    assert.equal(existsSync(executable), true);
    assert.equal(existsSync(join(cases, 'suite.json')), true);
    const fake = writeFakeAcc(root);
    const help = command(executable, ['--help'], root);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /agent-eval run/);
    assert.match(help.stdout, /agent-eval inspect/);

    const runProfile = (profileId: string, output: string, mode?: string) =>
      command(
        executable,
        [
          'run', '--agent', 'acc', '--command', fake, '--cases', cases,
          '--profile', profileId, '--output', output,
        ],
        root,
        {...process.env, ...(mode === undefined ? {} : {FAKE_MODE: mode})},
      );

    const smokePath = join(root, 'smoke.jsonl');
    const smokeRun = runProfile('smoke-v1', smokePath);
    assert.equal(smokeRun.status, 0, smokeRun.stderr);
    const smoke = report(smokePath);
    assert.equal(smoke.trials.length, 3);
    assert.deepEqual(smoke.trials.map((trial) => trial.caseId), [
      'create-to-spec', 'already-correct-no-op', 'preserve-user-wip',
    ]);
    assert.equal(smoke.report.profileVerdict, 'met');
    assert.equal(smoke.report.schemaVersion, 3);
    assert.equal(smoke.report.artifactSchemaVersion, 1);
    const inspected = command(
      executable,
      ['inspect', '--result', smokePath, '--case', 'create-to-spec', '--repeat', '1'],
      root,
    );
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stdout, /status: pass/);
    assert.match(inspected.stdout, /Git diff/);
    assert.match(inspected.stdout, /src\/slugify\.js/);

    const foundationPath = join(root, 'foundation.jsonl');
    const foundationRun = runProfile('foundation-v1', foundationPath);
    assert.equal(foundationRun.status, 0, foundationRun.stderr);
    const foundation = report(foundationPath);
    assert.equal(foundation.trials.length, 18);
    assert.deepEqual(
      foundation.trials.map((trial) => [trial.caseId, trial.repeat]),
      caseIds.flatMap((caseId) => [1, 2, 3].map((repeat) => [caseId, repeat])),
    );
    assert.equal(foundation.report.profileVerdict, 'met');
    assert.equal(foundation.report.aggregate.errors, 0);
    assert.deepEqual(
      foundation.report.aggregate.byPrimaryQuality.map(
        (quality: {quality: string; total: number}) => [quality.quality, quality.total],
      ),
      [
        ['task-effectiveness', 6],
        ['user-work-protection', 3],
        ['judgment-autonomy', 3],
        ['instruction-adherence', 3],
        ['verification-quality', 3],
      ],
    );
    assert.deepEqual(foundation.report.cleanup, {
      workspaces: true,
      adapterHomes: true,
      processes: true,
    });

    const failedPath = join(root, 'not-met.jsonl');
    const failedRun = runProfile('smoke-v1', failedPath, 'noedit');
    assert.equal(failedRun.status, 1);
    assert.equal(report(failedPath).report.profileVerdict, 'not_met');

    const errorPath = join(root, 'incomplete.jsonl');
    const errorRun = runProfile('smoke-v1', errorPath, 'malformed');
    assert.equal(errorRun.status, 1);
    const incomplete = report(errorPath);
    assert.equal(incomplete.report.profileVerdict, 'incomplete');
    assert.equal(incomplete.report.aggregate.errors, 3);
    for (const result of [smoke, foundation, report(failedPath), incomplete]) {
      assert.equal(result.trials.every((trial) =>
        (trial.cleanup as {workspace: boolean; adapterHome: boolean; process: boolean}).workspace &&
        (trial.cleanup as {workspace: boolean; adapterHome: boolean; process: boolean}).adapterHome &&
        (trial.cleanup as {workspace: boolean; adapterHome: boolean; process: boolean}).process
      ), true);
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
  assert.equal(existsSync(root), false);
});
