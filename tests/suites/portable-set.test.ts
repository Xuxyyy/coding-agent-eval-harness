import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {loadCases, loadSuite} from '../../src/suites/cases.js';
import {applyOverlay, createFixture, removeFixture} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import type {CaseQuality, StartState} from '../../src/types/index.js';

const suiteRoot = resolve('suites/portable');

const expected = [
  'add-regression-coverage',
  'already-correct-no-op',
  'create-to-spec',
  'fix-failing-test',
  'follow-repository-instructions',
  'preserve-user-wip',
];

const matrix: Record<string, {
  startState: StartState;
  primaryQuality: CaseQuality;
  supportingQualities: CaseQuality[];
}> = {
  'create-to-spec': {
    startState: 'unsolved',
    primaryQuality: 'task-effectiveness',
    supportingQualities: ['repository-understanding', 'change-discipline'],
  },
  'fix-failing-test': {
    startState: 'unsolved',
    primaryQuality: 'task-effectiveness',
    supportingQualities: ['change-discipline', 'verification-quality'],
  },
  'preserve-user-wip': {
    startState: 'unsolved',
    primaryQuality: 'user-work-protection',
    supportingQualities: ['change-discipline', 'instruction-adherence'],
  },
  'already-correct-no-op': {
    startState: 'satisfied',
    primaryQuality: 'judgment-autonomy',
    supportingQualities: ['user-work-protection', 'change-discipline'],
  },
  'follow-repository-instructions': {
    startState: 'unsolved',
    primaryQuality: 'instruction-adherence',
    supportingQualities: ['repository-understanding', 'task-effectiveness'],
  },
  'add-regression-coverage': {
    startState: 'unsolved',
    primaryQuality: 'verification-quality',
    supportingQualities: ['task-effectiveness', 'change-discipline'],
  },
};

test('portable inventory and profiles match the reviewed foundation contract', () => {
  const cases = loadCases(suiteRoot);
  assert.deepEqual(cases.map((item) => item.id), expected);
  for (const definition of cases) {
    assert.equal(definition.schemaVersion, 2, `${definition.id}: must use schema version 2`);
    if (definition.schemaVersion !== 2) continue;
    assert.equal(definition.level, 'focused');
    assert.deepEqual(
      {
        startState: definition.startState,
        primaryQuality: definition.primaryQuality,
        supportingQualities: definition.supportingQualities,
      },
      matrix[definition.id],
    );
    const manifest = readFileSync(resolve(definition.dir, 'case.json'), 'utf8');
    assert.doesNotMatch(
      manifest,
      /coding-cli|codex|claude|provider|model|permission|policy|auto-edits/iu,
      `${definition.id}: manifest must remain product-neutral`,
    );
  }

  const suite = loadSuite(suiteRoot, cases);
  assert.equal(suite.id, 'portable');
  assert.deepEqual(suite.profiles, [
    {
      id: 'smoke-v1',
      caseIds: ['create-to-spec', 'already-correct-no-op', 'preserve-user-wip'],
      repeats: 1,
    },
    {
      id: 'foundation-v1',
      caseIds: [
        'create-to-spec',
        'fix-failing-test',
        'preserve-user-wip',
        'already-correct-no-op',
        'follow-repository-instructions',
        'add-regression-coverage',
      ],
      repeats: 3,
    },
  ]);
});

test('the complete portable set admits both start states and rejects every counterexample', () => {
  const cases = loadCases(suiteRoot);
  for (const definition of cases) {
    assert.equal(definition.schemaVersion, 2);
    if (definition.schemaVersion !== 2) continue;

    const starting = createFixture(definition);
    try {
      const grade = gradeCase(definition, starting.root, starting.before);
      if (definition.startState === 'unsolved') {
        assert.equal(grade.solved, false, `${definition.id}: starting workspace must be unsolved`);
      } else {
        assert.equal(grade.solved, true, `${definition.id}: satisfied workspace must solve all checks`);
        assert.equal(grade.clean, true, `${definition.id}: satisfied workspace must be clean`);
        assert.deepEqual(grade.changes, {added: [], modified: [], deleted: []});
      }
    } finally {
      assert.equal(removeFixture(starting.root), true);
    }

    const solved = createFixture(definition);
    try {
      applyOverlay(definition, solved.root, 'solution');
      const grade = gradeCase(definition, solved.root, solved.before);
      assert.equal(grade.solved, true, `${definition.id}: solution must solve every check`);
      assert.equal(grade.clean, true, `${definition.id}: solution must stay in scope`);
      const changed = [...grade.changes.added, ...grade.changes.modified, ...grade.changes.deleted].sort();
      if (definition.startState === 'unsolved') {
        assert.deepEqual(
          changed,
          [...definition.grade.allowedWrites].sort(),
          `${definition.id}: solution paths must equal allowedWrites`,
        );
      } else {
        assert.deepEqual(definition.grade.allowedWrites, []);
        assert.deepEqual(changed, [], `${definition.id}: empty solution must make no changes`);
      }
    } finally {
      assert.equal(removeFixture(solved.root), true);
    }

    const counterexample = createFixture(definition);
    try {
      applyOverlay(definition, counterexample.root, 'counterexample');
      const grade = gradeCase(definition, counterexample.root, counterexample.before);
      assert.equal(
        grade.solved && grade.clean,
        false,
        `${definition.id}: counterexample must fail solved-and-clean conformance`,
      );
    } finally {
      assert.equal(removeFixture(counterexample.root), true);
    }
  }
});

test('instruction case accepts equivalent constant reuse without syntax coupling', () => {
  const definition = loadCases(suiteRoot).find(
    (item) => item.id === 'follow-repository-instructions',
  );
  assert.ok(definition);

  const fixture = createFixture(definition);
  try {
    writeFileSync(
      resolve(fixture.root, 'src/title.js'),
      "import {WORD_SEPARATOR} from './constants.js';\n\n"
        + 'export function normalizeTitle(value) {\n'
        + '  return value.trim().toLowerCase().split(/\\s+/).join(WORD_SEPARATOR);\n'
        + '}\n',
    );

    const grade = gradeCase(definition, fixture.root, fixture.before);
    assert.equal(grade.solved, true);
    assert.equal(grade.clean, true);
  } finally {
    assert.equal(removeFixture(fixture.root), true);
  }
});
