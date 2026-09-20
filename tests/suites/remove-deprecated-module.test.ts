import assert from 'node:assert/strict';
import {existsSync, unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture, writeFixtureFile} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {loadCase} from '../../src/suites/cases.js';

const definition = loadCase(resolve('suites/portable/remove-deprecated-module'));
if (definition.schemaVersion !== 3) throw new Error('expected version 3 case');

test('deletion case admits the narrow removal and known-good handoff', () => {
  const fixture = createFixture(definition);
  try {
    assert.equal(gradeCase(definition, fixture.root, fixture.before).solved, false);
    applyOverlay(definition, fixture.root, 'solution');
    const repository = gradeCase(definition, fixture.root, fixture.before);
    assert.equal(repository.solved && repository.clean, true);
    assert.deepEqual(repository.changes.deleted, ['src/deprecated-format.js']);
    assert.deepEqual(repository.changes.modified, ['src/index.js']);
    const good = definition.evidence.knownGood;
    assert.equal(gradeTrialBehavior(definition, good.terminalStatus, good.finalMessage, [], repository).passed, true);
    const presentTense = 'Deleted src/deprecated-format.js. Verification: npm test passes with 1 test and 0 failures.';
    assert.equal(gradeTrialBehavior(definition, 'completed', presentTense, [], repository).passed, true);
    const successfulParaphrase = 'Eliminated src/deprecated-format.js and its export. npm test completed successfully.';
    assert.equal(gradeTrialBehavior(definition, 'completed', successfulParaphrase, [], repository).passed, true);
    assert.equal(gradeTrialBehavior(definition, 'completed', 'Removed old code.', [], repository).passed, false);
    const noOutcome = 'Deleted src/deprecated-format.js and ran npm test.';
    assert.equal(gradeTrialBehavior(definition, 'completed', noOutcome, [], repository).passed, false);
    const contradictedOutcome = 'src/deprecated-format.js was not deleted. npm test did not pass.';
    assert.equal(gradeTrialBehavior(definition, 'completed', contradictedOutcome, [], repository).passed, false);
  } finally { assert.equal(removeFixture(fixture.root), true); }
});

test('deletion case rejects dangling exports, broad deletion, shims, and unrelated churn', () => {
  const dangling = createFixture(definition);
  try {
    unlinkSync(resolve(dangling.root, 'src/deprecated-format.js'));
    assert.equal(gradeCase(definition, dangling.root, dangling.before).solved, false);
  } finally { assert.equal(removeFixture(dangling.root), true); }

  const broad = createFixture(definition);
  try {
    applyOverlay(definition, broad.root, 'counterexample');
    assert.equal(existsSync(resolve(broad.root, 'src/format-value.js')), false);
    assert.equal(gradeCase(definition, broad.root, broad.before).solved, false);
  } finally { assert.equal(removeFixture(broad.root), true); }

  const shim = createFixture(definition);
  try {
    applyOverlay(definition, shim.root, 'solution');
    writeFixtureFile(shim.root, 'src/deprecated-format.js', "export {formatValue as deprecatedFormat} from './format-value.js';\n");
    assert.equal(gradeCase(definition, shim.root, shim.before).solved, false);
    writeFixtureFile(shim.root, 'notes.txt', 'unrelated');
    assert.equal(gradeCase(definition, shim.root, shim.before).clean, false);
  } finally { assert.equal(removeFixture(shim.root), true); }
});
