import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {loadCases, loadSuite} from '../../src/suites/cases.js';
import {applyOverlay, createFixture, removeFixture} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {selectCases} from '../../src/engine/select-cases.js';
import type {
  CaseHorizon,
  CaseModule,
  CaseQuality,
  CaseTier,
  StartState,
} from '../../src/types/index.js';

const suiteRoot = resolve('suites/portable');

const expected = [
  'accurate-change-handoff',
  'add-regression-coverage',
  'add-timeout-option-workflow',
  'already-correct-no-op',
  'block-on-missing-contract',
  'create-to-spec',
  'diagnose-root-cause',
  'fallback-after-tool-failure',
  'fix-failing-test',
  'follow-repository-instructions',
  'migrate-cross-package-api',
  'preserve-header-contract',
  'preserve-user-wip',
  'recover-transient-verification',
  'refactor-shared-validation',
  'regenerate-derived-source',
  'remove-deprecated-module',
  'repair-concurrent-cache',
  'repair-config-flow',
  'repair-stale-test-contract',
  'resolve-conflict-preserving-behavior',
  'restore-cli-error-contract',
  'resume-partial-migration',
  'trace-actual-runtime-path',
  'verify-cross-layer-fix',
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
  'repair-config-flow': {
    startState: 'unsolved',
    primaryQuality: 'repository-understanding',
    supportingQualities: ['task-effectiveness', 'change-discipline', 'verification-quality'],
  },
  'preserve-header-contract': {
    startState: 'unsolved',
    primaryQuality: 'change-discipline',
    supportingQualities: [
      'task-effectiveness',
      'repository-understanding',
      'user-work-protection',
      'verification-quality',
    ],
  },
  'recover-transient-verification': {
    startState: 'unsolved', primaryQuality: 'recovery-resilience',
    supportingQualities: ['task-effectiveness', 'verification-quality', 'communication-handoff'],
  },
  'accurate-change-handoff': {
    startState: 'unsolved', primaryQuality: 'communication-handoff',
    supportingQualities: ['task-effectiveness', 'verification-quality', 'change-discipline'],
  },
  'block-on-missing-contract': {
    startState: 'satisfied', primaryQuality: 'judgment-autonomy',
    supportingQualities: ['instruction-adherence', 'user-work-protection', 'communication-handoff'],
  },
  'remove-deprecated-module': {
    startState: 'unsolved', primaryQuality: 'user-work-protection',
    supportingQualities: ['change-discipline', 'repository-understanding', 'task-effectiveness'],
  },
  'diagnose-root-cause': {
    startState: 'satisfied', primaryQuality: 'communication-handoff',
    supportingQualities: ['repository-understanding', 'judgment-autonomy', 'user-work-protection'],
  },
  'repair-stale-test-contract': {
    startState: 'unsolved', primaryQuality: 'judgment-autonomy',
    supportingQualities: ['verification-quality', 'change-discipline', 'repository-understanding'],
  },
  'regenerate-derived-source': {
    startState: 'unsolved', primaryQuality: 'instruction-adherence',
    supportingQualities: ['verification-quality', 'change-discipline', 'task-effectiveness'],
  },
  'resolve-conflict-preserving-behavior': {
    startState: 'unsolved', primaryQuality: 'user-work-protection',
    supportingQualities: ['repository-understanding', 'change-discipline', 'task-effectiveness'],
  },
  'refactor-shared-validation': {
    startState: 'unsolved', primaryQuality: 'change-discipline',
    supportingQualities: ['repository-understanding', 'task-effectiveness', 'verification-quality'],
  },
  'migrate-cross-package-api': {
    startState: 'unsolved', primaryQuality: 'repository-understanding',
    supportingQualities: ['task-effectiveness', 'change-discipline', 'verification-quality'],
  },
  'repair-concurrent-cache': {
    startState: 'unsolved', primaryQuality: 'task-effectiveness',
    supportingQualities: ['repository-understanding', 'verification-quality', 'recovery-resilience'],
  },
  'restore-cli-error-contract': {
    startState: 'unsolved', primaryQuality: 'verification-quality',
    supportingQualities: ['task-effectiveness', 'repository-understanding', 'change-discipline'],
  },
  'trace-actual-runtime-path': {
    startState: 'unsolved', primaryQuality: 'repository-understanding',
    supportingQualities: ['task-effectiveness', 'change-discipline', 'verification-quality'],
  },
  'add-timeout-option-workflow': {
    startState: 'unsolved', primaryQuality: 'task-effectiveness',
    supportingQualities: ['repository-understanding', 'instruction-adherence', 'verification-quality'],
  },
  'fallback-after-tool-failure': {
    startState: 'unsolved', primaryQuality: 'recovery-resilience',
    supportingQualities: ['verification-quality', 'task-effectiveness', 'communication-handoff'],
  },
  'resume-partial-migration': {
    startState: 'unsolved', primaryQuality: 'recovery-resilience',
    supportingQualities: ['repository-understanding', 'user-work-protection', 'change-discipline'],
  },
  'verify-cross-layer-fix': {
    startState: 'unsolved', primaryQuality: 'verification-quality',
    supportingQualities: ['task-effectiveness', 'repository-understanding', 'communication-handoff'],
  },
};

const moduleCases: Record<CaseModule, string[]> = {
  reasoning: [
    'already-correct-no-op', 'block-on-missing-contract', 'diagnose-root-cause',
    'repair-stale-test-contract', 'trace-actual-runtime-path', 'repair-config-flow',
    'migrate-cross-package-api',
  ],
  execution: [
    'create-to-spec', 'fix-failing-test', 'preserve-user-wip',
    'follow-repository-instructions', 'remove-deprecated-module',
    'resolve-conflict-preserving-behavior', 'regenerate-derived-source',
    'preserve-header-contract', 'refactor-shared-validation',
    'repair-concurrent-cache', 'add-timeout-option-workflow',
  ],
  recovery: [
    'recover-transient-verification', 'fallback-after-tool-failure',
    'resume-partial-migration',
  ],
  verification: [
    'add-regression-coverage', 'accurate-change-handoff',
    'restore-cli-error-contract', 'verify-cross-layer-fix',
  ],
};

const tierCases: Record<CaseTier, string[]> = {
  baseline: [
    'already-correct-no-op', 'block-on-missing-contract', 'diagnose-root-cause',
    'create-to-spec', 'fix-failing-test', 'preserve-user-wip',
    'follow-repository-instructions', 'remove-deprecated-module',
    'resolve-conflict-preserving-behavior', 'recover-transient-verification',
    'fallback-after-tool-failure', 'add-regression-coverage', 'accurate-change-handoff',
  ],
  challenge: [
    'repair-stale-test-contract', 'trace-actual-runtime-path', 'repair-config-flow',
    'migrate-cross-package-api', 'regenerate-derived-source', 'preserve-header-contract',
    'refactor-shared-validation', 'repair-concurrent-cache', 'add-timeout-option-workflow',
    'resume-partial-migration', 'restore-cli-error-contract', 'verify-cross-layer-fix',
  ],
};

const horizons: Record<CaseHorizon, string[]> = {
  short: [
    'already-correct-no-op', 'block-on-missing-contract', 'diagnose-root-cause',
    'repair-stale-test-contract', 'create-to-spec', 'fix-failing-test',
    'preserve-user-wip', 'follow-repository-instructions', 'remove-deprecated-module',
    'resolve-conflict-preserving-behavior', 'recover-transient-verification',
    'add-regression-coverage', 'accurate-change-handoff',
  ],
  'multi-stage': [
    'trace-actual-runtime-path', 'repair-config-flow', 'migrate-cross-package-api',
    'regenerate-derived-source', 'preserve-header-contract', 'refactor-shared-validation',
    'repair-concurrent-cache', 'fallback-after-tool-failure', 'resume-partial-migration',
    'restore-cli-error-contract', 'verify-cross-layer-fix',
  ],
  'long-horizon': ['add-timeout-option-workflow'],
};

test('portable inventory and two-dimensional classification match the reviewed contract', () => {
  const cases = loadCases(suiteRoot);
  assert.deepEqual(cases.map((item) => item.id), expected);
  assert.equal(cases.filter((item) => item.schemaVersion === 5 && item.level === 'focused').length, 15);
  assert.equal(cases.filter((item) => item.schemaVersion === 5 && item.level === 'workflow').length, 10);
  for (const definition of cases) {
    assert.equal(definition.schemaVersion, 5, `${definition.id}: must use the tiered schema`);
    if (definition.schemaVersion !== 5) continue;
    assert.equal(
      definition.level,
      [
        'repair-config-flow',
        'preserve-header-contract',
        'refactor-shared-validation',
        'migrate-cross-package-api',
        'repair-concurrent-cache',
        'restore-cli-error-contract',
        'trace-actual-runtime-path',
        'add-timeout-option-workflow',
        'resume-partial-migration',
        'verify-cross-layer-fix',
      ].includes(definition.id)
        ? 'workflow'
        : 'focused',
    );
    assert.deepEqual(
      {
        startState: definition.startState,
        primaryQuality: definition.primaryQuality,
        supportingQualities: definition.supportingQualities,
      },
      matrix[definition.id],
    );
    assert.equal(
      definition.tier,
      Object.entries(tierCases).find(([, ids]) => ids.includes(definition.id))?.[0],
    );
    assert.equal(
      definition.primaryModule,
      Object.entries(moduleCases).find(([, ids]) => ids.includes(definition.id))?.[0],
    );
    assert.equal(
      definition.horizon,
      Object.entries(horizons).find(([, ids]) => ids.includes(definition.id))?.[0],
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
  assert.equal(suite.schemaVersion, 3);
  if (suite.schemaVersion !== 3) assert.fail('expected ordered suite');
  assert.deepEqual(suite.caseOrder, [...tierCases.baseline, ...tierCases.challenge]);
});

test('portable selection supports every tier and module combination in stable order', () => {
  const ordered = [...tierCases.baseline, ...tierCases.challenge];
  const definitions = loadCases(suiteRoot);
  const metadata = new Map(definitions.map((definition) => [definition.id, definition]));
  assert.deepEqual(selectCases({casesDir: suiteRoot}).selection.caseIds, ordered);

  for (const tier of ['baseline', 'challenge'] as const) {
    const tierOnly = selectCases({casesDir: suiteRoot, tier, repeats: 2});
    assert.deepEqual(tierOnly.selection.caseIds, tierCases[tier]);
    assert.equal(tierOnly.repeats, 2);
    assert.equal(tierOnly.selection.repeats, 2);
    for (const module of ['reasoning', 'execution', 'recovery', 'verification'] as const) {
      const expectedIds = ordered.filter((id) => {
        const definition = metadata.get(id)!;
        return definition.schemaVersion === 5 &&
          definition.tier === tier && definition.primaryModule === module;
      });
      const selected = selectCases({casesDir: suiteRoot, tier, module});
      assert.deepEqual(selected.selection.caseIds, expectedIds, `${tier}/${module}`);
      assert.equal(selected.selection.tier, tier);
      assert.equal(selected.selection.module, module);
    }
  }

  for (const module of ['reasoning', 'execution', 'recovery', 'verification'] as const) {
    assert.deepEqual(
      selectCases({casesDir: suiteRoot, module}).selection.caseIds,
      moduleCases[module],
    );
  }
});

test('the complete portable set admits both start states and rejects every counterexample', () => {
  const cases = loadCases(suiteRoot);
  for (const definition of cases) {
    assert.notEqual(definition.schemaVersion, 1);
    if (definition.schemaVersion === 1) continue;

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
      if (definition.schemaVersion === 5) {
        const evidence = definition.evidence.knownGood;
        const behavior = gradeTrialBehavior(
          definition, evidence.terminalStatus, evidence.finalMessage, evidence.controlledEvents, grade,
        );
        assert.equal(behavior.passed, true, `${definition.id}: known-good trial evidence must pass`);
      }
    } finally {
      assert.equal(removeFixture(solved.root), true);
    }

    const counterexample = createFixture(definition);
    try {
      applyOverlay(definition, counterexample.root, 'counterexample');
      const grade = gradeCase(definition, counterexample.root, counterexample.before);
      if (definition.schemaVersion === 5) {
        const evidence = definition.evidence.knownBad;
        const behavior = gradeTrialBehavior(
          definition, evidence.terminalStatus, evidence.finalMessage, evidence.controlledEvents, grade,
        );
        assert.equal(
          grade.solved && grade.clean && behavior.passed,
          false,
          `${definition.id}: counterexample must fail complete conformance`,
        );
      } else {
        assert.equal(grade.solved && grade.clean, false, `${definition.id}: counterexample must fail repository conformance`);
      }
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
