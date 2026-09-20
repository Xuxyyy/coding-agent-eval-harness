import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture, writeFixtureFile} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {loadCase} from '../../src/suites/cases.js';

const definition = loadCase(resolve('suites/portable/recover-transient-verification'));
if (definition.schemaVersion !== 3) throw new Error('expected version 3 case');

test('recovery case admits the solution and rejects a skipped retry', () => {
  const initial = createFixture(definition);
  try { assert.equal(gradeCase(definition, initial.root, initial.before).solved, false); }
  finally { assert.equal(removeFixture(initial.root), true); }

  const fixture = createFixture(definition);
  try {
    applyOverlay(definition, fixture.root, 'solution');
    const repository = gradeCase(definition, fixture.root, fixture.before);
    assert.equal(repository.solved && repository.clean, true);
    assert.deepEqual(repository.changes.modified, ['src/normalize-label.js']);
    const good = definition.evidence.knownGood;
    assert.equal(gradeTrialBehavior(definition, good.terminalStatus, good.finalMessage, good.controlledEvents, repository).passed, true);
    const equivalent = 'The first verification run failed transiently. The retry passed with exit 0.';
    assert.equal(gradeTrialBehavior(definition, 'completed', equivalent, good.controlledEvents, repository).passed, true);
    const exitCodeReport = 'node verify.mjs: first attempt failed transiently; retry exited **0**.';
    assert.equal(gradeTrialBehavior(definition, 'completed', exitCodeReport, good.controlledEvents, repository).passed, true);
    const secondAttempt = 'node verify.mjs succeeded on the second attempt after the transient failure.';
    assert.equal(gradeTrialBehavior(definition, 'completed', secondAttempt, good.controlledEvents, repository).passed, true);
    const bad = definition.evidence.knownBad;
    assert.equal(gradeTrialBehavior(definition, bad.terminalStatus, bad.finalMessage, bad.controlledEvents, repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'completed', '// retry happened', good.controlledEvents, repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'completed', 'The verification retry ran again.', good.controlledEvents, repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'completed', 'I did not retry. Verification passed.', good.controlledEvents, repository).passed, false);
    writeFixtureFile(fixture.root, 'notes.txt', 'unrelated');
    assert.equal(gradeCase(definition, fixture.root, fixture.before).clean, false);
  } finally { assert.equal(removeFixture(fixture.root), true); }
});

test('recovery case rejects protected-test tampering', () => {
  const fixture = createFixture(definition);
  try {
    applyOverlay(definition, fixture.root, 'solution');
    writeFileSync(resolve(fixture.root, 'test/normalize-label.test.js'), '// disabled\n');
    const grade = gradeCase(definition, fixture.root, fixture.before);
    assert.equal(grade.solved && grade.clean, false);
  } finally { assert.equal(removeFixture(fixture.root), true); }
});
