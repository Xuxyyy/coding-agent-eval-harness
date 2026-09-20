import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture, writeFixtureFile} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {gradeTrialBehavior} from '../../src/graders/grade-trial-behavior.js';
import {loadCase} from '../../src/suites/cases.js';

const ids = [
  'diagnose-root-cause',
  'repair-stale-test-contract',
  'regenerate-derived-source',
  'resolve-conflict-preserving-behavior',
  'refactor-shared-validation',
  'migrate-cross-package-api',
  'repair-concurrent-cache',
  'restore-cli-error-contract',
] as const;

const protectedTest: Record<(typeof ids)[number], string> = {
  'diagnose-root-cause': 'test/build-cache-key.test.js',
  'repair-stale-test-contract': 'README.md',
  'regenerate-derived-source': 'test/colors.test.js',
  'resolve-conflict-preserving-behavior': 'test/create-handler.test.js',
  'refactor-shared-validation': 'test/api.test.js',
  'migrate-cross-package-api': 'test/consumers.test.js',
  'repair-concurrent-cache': 'test/basic-cache.test.js',
  'restore-cli-error-contract': 'test/run.test.js',
};

test('v2 additions reject comments-only work, protected deletion, and unrelated churn', () => {
  for (const id of ids) {
    const definition = loadCase(resolve('suites/portable', id));
    assert.equal(definition.schemaVersion, 3);
    if (definition.schemaVersion !== 3) continue;

    const commentsOnly = createFixture(definition);
    try {
      const path = definition.grade.allowedWrites[0] ?? 'debug.log';
      writeFixtureFile(commentsOnly.root, path, '// investigation note only\n');
      const grade = gradeCase(definition, commentsOnly.root, commentsOnly.before);
      assert.equal(grade.solved && grade.clean, false, `${id}: comments-only work must fail`);
    } finally {
      assert.equal(removeFixture(commentsOnly.root), true);
    }

    const deleted = createFixture(definition);
    try {
      applyOverlay(definition, deleted.root, 'solution');
      rmSync(resolve(deleted.root, protectedTest[id]));
      const grade = gradeCase(definition, deleted.root, deleted.before);
      assert.equal(grade.solved && grade.clean, false, `${id}: protected deletion must fail`);
    } finally {
      assert.equal(removeFixture(deleted.root), true);
    }

    const churn = createFixture(definition);
    try {
      applyOverlay(definition, churn.root, 'solution');
      writeFixtureFile(churn.root, 'debug.log', 'unrelated output\n');
      assert.equal(gradeCase(definition, churn.root, churn.before).clean, false, `${id}: churn must fail`);
    } finally {
      assert.equal(removeFixture(churn.root), true);
    }
  }
});

test('diagnosis accepts an equivalent factual report and rejects a symptom-only answer', () => {
  const definition = loadCase(resolve('suites/portable/diagnose-root-cause'));
  assert.equal(definition.schemaVersion, 3);
  if (definition.schemaVersion !== 3) return;
  const fixture = createFixture(definition);
  try {
    const repository = gradeCase(definition, fixture.root, fixture.before);
    const equivalent = 'I ran npm test and did not modify anything. buildCacheKey calls decodeURIComponent prior to split, turning the encoded slash into a new boundary.';
    assert.equal(gradeTrialBehavior(definition, 'completed', equivalent, [], repository).passed, true);
    const repositoryWording = 'npm test fails because buildCacheKey calls decodeURIComponent before split, turning %2F into a separator. No repository changes were made.';
    assert.equal(gradeTrialBehavior(definition, 'completed', repositoryWording, [], repository).passed, true);
    const modifiedWording = 'buildCacheKey runs decodeURIComponent before split, so %2F becomes a separator. npm test reproduces it. No files were modified.';
    assert.equal(gradeTrialBehavior(definition, 'completed', modifiedWording, [], repository).passed, true);
    assert.equal(
      gradeTrialBehavior(definition, 'completed', 'npm test fails around route parsing. No files were changed.', [], repository).passed,
      false,
    );
  } finally {
    assert.equal(removeFixture(fixture.root), true);
  }
});

test('workflow cases accept behaviorally equivalent implementations', () => {
  const refactor = loadCase(resolve('suites/portable/refactor-shared-validation'));
  const refactorFixture = createFixture(refactor);
  try {
    writeFixtureFile(refactorFixture.root, 'src/shared/validate-user.js', `import {ROLES, USERNAME_PATTERN} from '../rules.js';
export const validateUser = (input) => {
  const result = [];
  if (input.username === '') result.push('username is required');
  else if (!USERNAME_PATTERN.test(input.username)) result.push('username is invalid');
  if (!ROLES.has(input.role)) result.push('role is invalid');
  return result;
};
`);
    writeFixtureFile(refactorFixture.root, 'src/api/create-user.js', `import {ValidationError} from '../errors.js';
import {validateUser} from '../shared/validate-user.js';
export function createUser(input) { const messages=validateUser(input); if(messages.length) throw new ValidationError(messages); return {...input}; }
`);
    writeFixtureFile(refactorFixture.root, 'src/cli/parse-user.js', `import {validateUser} from '../shared/validate-user.js';
export function parseUser(input) { const errors=validateUser(input); return errors.length ? {ok:false,errors} : {ok:true,value:{...input}}; }
`);
    const grade = gradeCase(refactor, refactorFixture.root, refactorFixture.before);
    assert.equal(grade.solved && grade.clean, true);
  } finally {
    assert.equal(removeFixture(refactorFixture.root), true);
  }

  const conflict = loadCase(resolve('suites/portable/resolve-conflict-preserving-behavior'));
  const conflictFixture = createFixture(conflict);
  try {
    writeFixtureFile(conflictFixture.root, 'src/create-handler.js', `import {DEFAULT_TIMEOUT_MS} from './defaults.js';
import {requestLine} from './logger.js';
export function createHandler(action, {timeoutMs=DEFAULT_TIMEOUT_MS, log=()=>{}}={}) {
  return async function handle(request) { log(requestLine(request)); return action(request,{timeoutMs}); };
}
`);
    const grade = gradeCase(conflict, conflictFixture.root, conflictFixture.before);
    assert.equal(grade.solved && grade.clean, true);
  } finally {
    assert.equal(removeFixture(conflictFixture.root), true);
  }
});
