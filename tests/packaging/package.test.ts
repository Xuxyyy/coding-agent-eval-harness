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

test('packed installation executes all profiles and preserves verdict distinctions', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-package-'));
  try {
    const dry = command('npm', ['pack', '--dry-run', '--json'], resolve('.'));
    assert.equal(dry.status, 0, dry.stderr);
    const dryRecord = JSON.parse(dry.stdout)[0] as PackRecord;
    const paths = dryRecord.files.map((file) => file.path).sort();
    assert.equal(paths.includes('suites/portable/suite.json'), true);
    assert.equal(paths.includes('suites/portable/README.md'), true);
    assert.equal(paths.includes('docs/suite-taxonomy.md'), true);
    assert.equal(paths.includes('dist/evidence/artifacts.js'), true);
    assert.equal(paths.includes('dist/evidence/artifacts.d.ts'), true);
    const foundationCaseIds = [
      'create-to-spec',
      'fix-failing-test',
      'preserve-user-wip',
      'already-correct-no-op',
      'follow-repository-instructions',
      'add-regression-coverage',
    ];
    const workflowCaseIds = ['repair-config-flow', 'preserve-header-contract'];
    const measurementCaseIds = [
      'recover-transient-verification',
      'accurate-change-handoff',
      'block-on-missing-contract',
      'remove-deprecated-module',
    ];
    const focusedCaseIds = [...foundationCaseIds, ...measurementCaseIds];
    const fullCaseIds = [...focusedCaseIds, ...workflowCaseIds];
    const allCaseIds = fullCaseIds;
    for (const caseId of allCaseIds) {
      const prefix = `suites/portable/${caseId}/`;
      assert.equal(paths.includes(`${prefix}case.json`), true, `${caseId}: case manifest missing`);
      for (const tree of ['workspace/', 'solution/', 'counterexample/']) {
        assert.equal(
          paths.some((path) => path.startsWith(`${prefix}${tree}`)),
          true,
          `${caseId}: ${tree} missing`,
        );
      }
      if (measurementCaseIds.includes(caseId)) {
        assert.equal(paths.includes(`${prefix}evidence/known-good.json`), true);
        assert.equal(paths.includes(`${prefix}evidence/known-bad.json`), true);
      }
    }
    const workflowFiles = [
      'suites/portable/repair-config-flow/case.json',
      'suites/portable/repair-config-flow/workspace/README.md',
      'suites/portable/repair-config-flow/workspace/package.json',
      'suites/portable/repair-config-flow/workspace/src/default-config.js',
      'suites/portable/repair-config-flow/workspace/src/resolve-config.js',
      'suites/portable/repair-config-flow/workspace/src/server-options.js',
      'suites/portable/repair-config-flow/workspace/test/resolve-config.test.js',
      'suites/portable/repair-config-flow/workspace/test/server-options.test.js',
      'suites/portable/repair-config-flow/workspace/verify-config-flow.mjs',
      'suites/portable/repair-config-flow/solution/src/server-options.js',
      'suites/portable/repair-config-flow/solution/test/server-options-regression.test.js',
      'suites/portable/repair-config-flow/counterexample/src/server-options.js',
      'suites/portable/repair-config-flow/counterexample/test/server-options-regression.test.js',
      'suites/portable/preserve-header-contract/case.json',
      'suites/portable/preserve-header-contract/workspace/README.md',
      'suites/portable/preserve-header-contract/workspace/package.json',
      'suites/portable/preserve-header-contract/workspace/src/create-request.js',
      'suites/portable/preserve-header-contract/workspace/src/index.js',
      'suites/portable/preserve-header-contract/workspace/src/merge-headers.js',
      'suites/portable/preserve-header-contract/workspace/test/request.test.js',
      'suites/portable/preserve-header-contract/workspace/verify-header-contract.mjs',
      'suites/portable/preserve-header-contract/solution/src/merge-headers.js',
      'suites/portable/preserve-header-contract/solution/test/header-case-regression.test.js',
      'suites/portable/preserve-header-contract/counterexample/src/merge-headers.js',
      'suites/portable/preserve-header-contract/counterexample/test/header-case-regression.test.js',
    ];
    for (const path of workflowFiles) {
      assert.equal(paths.includes(path), true, `${path}: package entry missing`);
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
    assert.equal(smoke.report.schemaVersion, 4);
    assert.equal(smoke.report.artifactSchemaVersion, 2);
    const inspected = command(
      executable,
      ['inspect', '--result', smokePath, '--case', 'create-to-spec', '--repeat', '1'],
      root,
    );
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stdout, /status: pass/);
    assert.match(inspected.stdout, /Git diff/);
    assert.match(inspected.stdout, /src\/slugify\.js/);

    const focusedPath = join(root, 'focused.jsonl');
    const focusedRun = runProfile('focused-v1', focusedPath);
    assert.equal(focusedRun.status, 0, focusedRun.stderr);
    const focused = report(focusedPath);
    assert.equal(focused.trials.length, 10);
    assert.deepEqual(focused.trials.map((trial) => trial.caseId), focusedCaseIds);
    assert.equal(focused.report.profile.profileId, 'focused-v1');
    assert.equal(focused.report.profile.repeats, 1);
    assert.equal(focused.report.profileVerdict, 'met');

    const foundationPath = join(root, 'foundation.jsonl');
    const foundationRun = runProfile('foundation-v1', foundationPath);
    assert.equal(foundationRun.status, 0, foundationRun.stderr);
    const foundation = report(foundationPath);
    assert.equal(foundation.trials.length, 18);
    assert.deepEqual(
      foundation.trials.map((trial) => [trial.caseId, trial.repeat]),
      foundationCaseIds.flatMap((caseId) => [1, 2, 3].map((repeat) => [caseId, repeat])),
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
      controls: true,
    });

    const workflowPath = join(root, 'workflow.jsonl');
    const workflowRun = runProfile('workflow-v1', workflowPath);
    assert.equal(workflowRun.status, 0, workflowRun.stderr);
    const workflow = report(workflowPath);
    assert.equal(workflow.trials.length, 2);
    assert.deepEqual(workflow.trials.map((trial) => trial.caseId), workflowCaseIds);
    assert.deepEqual(workflow.trials.map((trial) => trial.status), ['pass', 'pass']);
    assert.equal(workflow.report.profile.profileId, 'workflow-v1');
    assert.equal(workflow.report.profile.repeats, 1);
    assert.equal(workflow.report.profileVerdict, 'met');
    assert.deepEqual(
      workflow.report.aggregate.byPrimaryQuality.map(
        (quality: {quality: string; total: number}) => [quality.quality, quality.total],
      ),
      [['repository-understanding', 1], ['change-discipline', 1]],
    );
    assert.deepEqual(workflow.report.cleanup, {
      workspaces: true,
      adapterHomes: true,
      processes: true,
      controls: true,
    });
    const workflowInspect = command(
      executable,
      ['inspect', '--result', workflowPath, '--case', 'repair-config-flow', '--repeat', '1'],
      root,
    );
    assert.equal(workflowInspect.status, 0, workflowInspect.stderr);
    assert.match(workflowInspect.stdout, /status: pass/);
    assert.match(workflowInspect.stdout, /src\/server-options\.js/);
    assert.match(workflowInspect.stdout, /test\/server-options-regression\.test\.js/);

    const measurementPath = join(root, 'measurement.jsonl');
    const measurementRun = runProfile('measurement-v1', measurementPath);
    assert.equal(measurementRun.status, 0, measurementRun.stderr);
    const measurement = report(measurementPath);
    assert.deepEqual(measurement.trials.map((trial) => trial.caseId), measurementCaseIds);
    assert.equal(measurement.trials.every((trial) => trial.status === 'pass'), true);
    assert.equal(measurement.report.profileVerdict, 'met');
    assert.deepEqual(
      measurement.trials.map((trial) => trial.expectedDisposition),
      ['implemented', 'implemented', 'blocked', 'implemented'],
    );
    assert.equal(measurement.trials.every((trial) => trial.repositoryPassed && trial.behaviorPassed), true);
    const recoveryTrial = measurement.trials[0] as Record<string, any>;
    assert.deepEqual(
      recoveryTrial.behaviorGrade.controlledEvents.events.map((event: {outcome: string}) => event.outcome),
      ['transient-failure', 'passed'],
    );
    const deletionInspect = command(
      executable,
      ['inspect', '--result', measurementPath, '--case', 'remove-deprecated-module', '--repeat', '1'],
      root,
    );
    assert.equal(deletionInspect.status, 0, deletionInspect.stderr);
    assert.match(deletionInspect.stdout, /deleted: src\/deprecated-format\.js/);

    const fullPath = join(root, 'full.jsonl');
    const fullRun = runProfile('full-v1', fullPath);
    assert.equal(fullRun.status, 0, fullRun.stderr);
    const full = report(fullPath);
    assert.equal(full.trials.length, 12);
    assert.deepEqual(full.trials.map((trial) => trial.caseId), fullCaseIds);
    assert.equal(full.report.profile.profileId, 'full-v1');
    assert.equal(full.report.profile.repeats, 1);
    assert.equal(full.report.profileVerdict, 'met');

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
    for (const result of [
      smoke,
      focused,
      foundation,
      workflow,
      measurement,
      full,
      report(failedPath),
      incomplete,
    ]) {
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
