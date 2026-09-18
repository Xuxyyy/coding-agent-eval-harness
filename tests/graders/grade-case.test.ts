import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {snapshot} from '../../src/environments/fixture.js';
import {gradeCase, pathsOutsideAllowed, truncate} from '../../src/graders/grade-case.js';
import type {CaseDefinition} from '../../src/types/index.js';

function definition(checks: CaseDefinition['grade']['checks']): CaseDefinition {
  return {
    schemaVersion: 2,
    id: 'grade',
    level: 'focused',
    primaryQuality: 'task-effectiveness',
    supportingQualities: [],
    startState: 'unsolved',
    task: {prompt: 'grade', maxSeconds: 1},
    grade: {allowedWrites: ['allowed.txt'], checks},
    dir: '/unused',
  };
}

test('gradeCase passes exists, exit0, and unchanged checks', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-grade-'));
  try {
    writeFileSync(join(root, 'kept.txt'), 'same');
    const before = snapshot(root);
    writeFileSync(join(root, 'allowed.txt'), 'new');
    const result = gradeCase(
      definition([
        {kind: 'exists', path: 'allowed.txt'},
        {kind: 'exit0', command: 'node -e "process.exit(0)"'},
        {kind: 'unchanged', path: 'kept.txt'},
      ]),
      root,
      before,
    );
    assert.equal(result.solved, true);
    assert.equal(result.clean, true);
    assert.deepEqual(result.changes.added, ['allowed.txt']);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('gradeCase reports every check failure and exact scope violations', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-grade-'));
  try {
    writeFileSync(join(root, 'kept.txt'), 'same');
    const before = snapshot(root);
    writeFileSync(join(root, 'kept.txt'), 'changed');
    writeFileSync(join(root, 'outside.txt'), 'bad');
    const result = gradeCase(
      definition([
        {kind: 'exists', path: 'missing.txt'},
        {kind: 'exit0', command: 'node -e "process.exit(3)"'},
        {kind: 'unchanged', path: 'kept.txt'},
      ]),
      root,
      before,
    );
    assert.equal(result.solved, false);
    assert.equal(result.clean, false);
    assert.deepEqual(result.checks.map((item) => item.ok), [false, false, false]);
    assert.deepEqual(result.scopeViolations, ['kept.txt', 'outside.txt']);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('gradeCase handles absent, contains, and matches without throwing', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-grade-'));
  try {
    mkdirSync(join(root, 'directory'));
    writeFileSync(join(root, 'content.txt'), 'literal .* marker\nfixed   value\n');
    const before = snapshot(root);
    const result = gradeCase(
      definition([
        {kind: 'absent', path: 'missing.txt'},
        {kind: 'contains', path: 'content.txt', text: 'literal .* marker'},
        {kind: 'matches', path: 'content.txt', pattern: 'fixed\\s+value'},
        {kind: 'absent', path: 'content.txt'},
        {kind: 'contains', path: 'missing.txt', text: 'x'},
        {kind: 'matches', path: 'directory', pattern: 'x'},
      ]),
      root,
      before,
    );
    assert.deepEqual(result.checks.map((item) => item.ok), [true, true, true, false, false, false]);
    assert.match(result.checks[4]!.detail, /is missing/);
    assert.match(result.checks[5]!.detail, /not a regular file/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('scope enforcement is exact and details are bounded', () => {
  assert.deepEqual(
    pathsOutsideAllowed(
      {added: ['src/a.js.bak'], modified: ['src/a.js'], deleted: []},
      ['src/a.js'],
    ),
    ['src/a.js.bak'],
  );
  assert.match(truncate('x'.repeat(100), 10), /^xxxxxxxxxx… \[truncated 90 chars\]$/);
});
