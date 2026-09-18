import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate} from '../../src/reports/aggregate.js';
import {profileVerdict} from '../../src/reports/profile-verdict.js';
import type {CaseQuality, TrialRecord} from '../../src/types/index.js';

function trial(
  caseId: string,
  status: TrialRecord['status'],
  repeat = 1,
  primaryQuality: CaseQuality | null = null,
): TrialRecord {
  return {
    kind: 'trial',
    caseId,
    repeat,
    adapter: 'fake',
    requestedModel: null,
    level: null,
    primaryQuality,
    supportingQualities: [],
    startState: null,
    terminalStatus: status === 'error' ? 'error' : 'completed',
    status,
    solved: status === 'pass',
    clean: true,
    elapsedMs: 1,
    usage: null,
    checks: [],
    changes: {added: [], modified: [], deleted: []},
    scopeViolations: [],
    cleanup: {workspace: true, adapterHome: true, process: true},
    rawResultPath: null,
    artifactManifestPath: null,
    ...(status === 'error' ? {error: 'launch failed'} : {}),
  };
}

test('aggregate excludes errors from rates and combines repeated cases', () => {
  const report = aggregate([
    trial('a', 'pass'),
    trial('a', 'fail'),
    trial('b', 'error'),
  ]);
  assert.equal(report.total, 3);
  assert.equal(report.scored, 2);
  assert.equal(report.errors, 1);
  assert.deepEqual(report.passes, {count: 1, of: 2, rate: 0.5});
  assert.deepEqual(report.byCase, [
    {id: 'a', total: 2, required: null, complete: null, scored: 2, errors: 0, passes: 1},
    {id: 'b', total: 1, required: null, complete: null, scored: 0, errors: 1, passes: 0},
  ]);
  assert.deepEqual(report.byPrimaryQuality, []);
});

test('aggregate reports primary qualities and repeat completeness', () => {
  const report = aggregate(
    [
      trial('a', 'pass', 1, 'task-effectiveness'),
      trial('a', 'fail', 2, 'task-effectiveness'),
      trial('b', 'error', 1, 'verification-quality'),
    ],
    {caseIds: ['a', 'b'], repeats: 2},
  );
  assert.deepEqual(report.byCase, [
    {id: 'a', total: 2, required: 2, complete: true, scored: 2, errors: 0, passes: 1},
    {id: 'b', total: 1, required: 2, complete: false, scored: 0, errors: 1, passes: 0},
  ]);
  assert.deepEqual(report.byPrimaryQuality, [
    {
      quality: 'task-effectiveness',
      total: 2,
      scored: 2,
      errors: 0,
      passes: {count: 1, of: 2, rate: 0.5},
    },
    {
      quality: 'verification-quality',
      total: 1,
      scored: 0,
      errors: 1,
      passes: {count: 0, of: 0, rate: null},
    },
  ]);
});

test('profile verdict distinguishes met, not_met, and incomplete', () => {
  const requirement = {caseIds: ['a', 'b'], repeats: 1};
  assert.equal(profileVerdict([trial('a', 'pass'), trial('b', 'pass')], requirement), 'met');
  assert.equal(profileVerdict([trial('a', 'pass'), trial('b', 'fail')], requirement), 'not_met');
  assert.equal(profileVerdict([trial('a', 'pass'), trial('b', 'error')], requirement), 'incomplete');
  assert.equal(profileVerdict([trial('a', 'pass')], requirement), 'incomplete');
  assert.equal(
    profileVerdict([trial('a', 'pass'), trial('a', 'pass'), trial('b', 'pass')], requirement),
    'incomplete',
  );
});
