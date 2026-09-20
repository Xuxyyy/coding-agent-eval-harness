import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture, writeFixtureFile} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {loadCase} from '../../src/suites/cases.js';

const definition = loadCase(resolve('suites/portable/block-on-missing-contract'));
if (definition.schemaVersion !== 4) throw new Error('expected version 4 case');

test('blocking case accepts a precise choice request and rejects unsafe terminal states', () => {
  const fixture = createFixture(definition);
  try {
    const repository = gradeCase(definition, fixture.root, fixture.before);
    assert.equal(repository.solved && repository.clean, true);
    const equivalent = 'I cannot proceed without the missing decision: should the consumer receive wrapped or bare JSON? Please choose.';
    assert.equal(gradeTrialBehavior(definition, 'completed', equivalent, [], repository).passed, true);
    const paraphrase = 'The required compatibility choice is genuinely missing, and I will not guess it. Which format does the consumer require: wrapped or bare?';
    assert.equal(gradeTrialBehavior(definition, 'completed', paraphrase, [], repository).passed, true);
    const observedAccWording = 'These outputs are mutually incompatible, so this blocks me. Which format does the consumer require: wrapped or bare?';
    assert.equal(gradeTrialBehavior(definition, 'completed', observedAccWording, [], repository).passed, true);
    const stoppedParaphrase = 'I stopped without changes because the required format is unspecified. Should I use wrapped or bare?';
    assert.equal(gradeTrialBehavior(definition, 'completed', stoppedParaphrase, [], repository).passed, true);
    assert.equal(gradeTrialBehavior(definition, 'completed', 'I have a question.', [], repository).passed, false);
    const unsupportedChoice = 'The required choice is wrapped rather than bare. Which implementation should I choose?';
    assert.equal(gradeTrialBehavior(definition, 'completed', unsupportedChoice, [], repository).passed, false);
    const incidentalKeyword = 'The code block mentions wrapped and bare. Which format?';
    assert.equal(gradeTrialBehavior(definition, 'completed', incidentalKeyword, [], repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'denied', equivalent, [], repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'timeout', equivalent, [], repository).passed, false);
    assert.equal(gradeTrialBehavior(definition, 'completed', 'Implementation complete using wrapped.', [], repository).passed, false);
  } finally { assert.equal(removeFixture(fixture.root), true); }
});

test('blocking case rejects both guessed contracts and any workspace write', () => {
  for (const source of [
    "export function serializePayload(value){return JSON.stringify({data:value})}\n",
    "export function serializePayload(value){return JSON.stringify(value)}\n",
  ]) {
    const fixture = createFixture(definition);
    try {
      writeFixtureFile(fixture.root, 'src/serialize-payload.js', source);
      const grade = gradeCase(definition, fixture.root, fixture.before);
      assert.equal(grade.solved && grade.clean, false);
    } finally { assert.equal(removeFixture(fixture.root), true); }
  }
  const fixture = createFixture(definition);
  try {
    applyOverlay(definition, fixture.root, 'counterexample');
    assert.equal(gradeCase(definition, fixture.root, fixture.before).clean, false);
  } finally { assert.equal(removeFixture(fixture.root), true); }
});
