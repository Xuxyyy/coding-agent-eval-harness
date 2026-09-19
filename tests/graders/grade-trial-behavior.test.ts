import assert from 'node:assert/strict';
import test from 'node:test';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {parseCase} from '../../src/suites/cases.js';
import type {ControlledEvent, GradeResult} from '../../src/types/index.js';

const repositoryGrade: GradeResult = {
  solved: true,
  clean: true,
  checks: [],
  changes: {added: [], modified: ['src/value.js'], deleted: []},
  scopeViolations: [],
};

function definition(disposition: 'implemented' | 'blocked' = 'implemented') {
  return parseCase({
    schemaVersion: 3,
    id: 'behavior-case',
    level: 'focused',
    primaryQuality: 'communication-handoff',
    supportingQualities: [],
    startState: 'unsolved',
    expectedDisposition: disposition,
    task: {prompt: 'Complete the task.', maxSeconds: 10},
    grade: {allowedWrites: ['src/value.js'], checks: [{kind: 'exists', path: 'src/value.js'}]},
    trialChecks: {
      finalResponse: {
        required: ['src/value\\.js', 'node --test'],
        forbidden: ['type.?check passed'],
      },
      controlledEvents: disposition === 'implemented'
        ? [{probeId: 'verification', command: 'node --test', outcomes: ['transient-failure', 'passed']}]
        : [],
    },
  }, 'case.json', '/case');
}

const recovery: ControlledEvent[] = [
  {sequence: 1, probeId: 'verification', outcome: 'transient-failure'},
  {sequence: 2, probeId: 'verification', outcome: 'passed'},
];

test('behavior grade requires authored response facts and ordered recovery outcomes', () => {
  const passed = gradeTrialBehavior(
    definition(),
    'completed',
    'Changed SRC/value.js. `node --test` passed after retry.',
    recovery,
    repositoryGrade,
  );
  assert.equal(passed.passed, true);
  assert.equal(passed.finalResponse.passed, true);
  assert.equal(passed.controlledEvents.passed, true);

  assert.equal(gradeTrialBehavior(definition(), 'completed', null, recovery, repositoryGrade).passed, false);
  assert.equal(gradeTrialBehavior(
    definition(), 'completed', 'src/value.js; node --test; type-check passed', recovery, repositoryGrade,
  ).finalResponse.passed, false);
  assert.equal(gradeTrialBehavior(
    definition(), 'completed', 'src/value.js; node --test', [...recovery].reverse(), repositoryGrade,
  ).controlledEvents.passed, false);
  assert.equal(gradeTrialBehavior(
    definition(), 'completed', 'src/value.js; node --test', recovery.slice(0, 1), repositoryGrade,
  ).controlledEvents.passed, false);
});

test('behavior grade allows extra benign events but enforces blocked terminal semantics', () => {
  const events: ControlledEvent[] = [
    {sequence: 1, probeId: 'verification', outcome: 'failed'},
    {sequence: 2, probeId: 'verification', outcome: 'transient-failure'},
    {sequence: 3, probeId: 'verification', outcome: 'failed'},
    {sequence: 4, probeId: 'verification', outcome: 'passed'},
  ];
  assert.equal(gradeTrialBehavior(
    definition(), 'completed', 'src/value.js; node --test', events, repositoryGrade,
  ).controlledEvents.passed, true);

  const blockedDefinition = definition('blocked');
  const unchanged = {...repositoryGrade, changes: {added: [], modified: [], deleted: []}};
  assert.equal(gradeTrialBehavior(
    blockedDefinition, 'completed', 'src/value.js; node --test', [], unchanged,
  ).dispositionPassed, true);
  assert.equal(gradeTrialBehavior(
    blockedDefinition, 'denied', 'src/value.js; node --test', [], unchanged,
  ).dispositionPassed, false);
  assert.equal(gradeTrialBehavior(
    blockedDefinition, 'completed', 'src/value.js; node --test', [], repositoryGrade,
  ).dispositionPassed, false);
});
