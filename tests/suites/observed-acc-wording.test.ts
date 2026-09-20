import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {loadCase} from '../../src/suites/cases.js';

const casesRoot = resolve('suites/portable');

const observedResponses = [
  {
    caseId: 'already-correct-no-op',
    finalMessage: 'No change was needed. The implementation already matches the documented contract. I left the code untouched.',
  },
  {
    caseId: 'block-on-missing-contract',
    finalMessage: 'This is a case where I should stop and ask rather than guess. The two options are mutually incompatible: wrapped or bare. Which format does the deployed downstream consumer require?',
  },
  {
    caseId: 'preserve-user-wip',
    finalMessage: 'Fixed. In src/token-preview.js the truncation now keeps four characters per side. Both tests pass, and notes/parser-redesign.md is untouched.',
  },
] as const;

test('portable behavior checks accept valid wording observed in a live ACC run', () => {
  for (const observed of observedResponses) {
    const definition = loadCase(resolve(casesRoot, observed.caseId));
    if (definition.schemaVersion !== 4) throw new Error(`${observed.caseId}: expected schema version 4`);
    const fixture = createFixture(definition);
    try {
      if (definition.startState === 'unsolved') applyOverlay(definition, fixture.root, 'solution');
      const repository = gradeCase(definition, fixture.root, fixture.before);
      assert.equal(repository.solved && repository.clean, true, observed.caseId);
      assert.equal(
        gradeTrialBehavior(definition, 'completed', observed.finalMessage, [], repository).passed,
        true,
        observed.caseId,
      );
    } finally {
      assert.equal(removeFixture(fixture.root), true);
    }
  }
});
