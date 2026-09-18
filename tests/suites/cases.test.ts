import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  CaseError,
  loadCase,
  loadCases,
  parseCase,
  parseSuite,
  safeRelativePath,
} from '../../src/suites/cases.js';

const valid = {
  schemaVersion: 1,
  id: 'sample',
  category: 'edit',
  task: {prompt: 'Fix it.', maxSeconds: 10},
  grade: {
    allowedWrites: ['src/a.js'],
    checks: [
      {kind: 'exists', path: 'src/a.js'},
      {kind: 'exit0', command: 'node --test'},
      {kind: 'unchanged', path: 'test/a.test.js'},
    ],
  },
};

const validV2 = {
  schemaVersion: 2,
  id: 'sample-v2',
  level: 'focused',
  primaryQuality: 'task-effectiveness',
  supportingQualities: ['change-discipline'],
  startState: 'unsolved',
  task: {prompt: 'Fix it.', maxSeconds: 10},
  grade: {
    allowedWrites: ['src/a.js'],
    checks: [
      {kind: 'absent', path: 'debug.log'},
      {kind: 'contains', path: 'src/a.js', text: 'fixed'},
      {kind: 'matches', path: 'src/a.js', pattern: 'fixed\\s+value'},
    ],
  },
};

test('parseCase accepts the complete neutral schema', () => {
  const parsed = parseCase(valid, 'case.json', '/case');
  assert.equal(parsed.id, 'sample');
  assert.equal(parsed.task.maxSeconds, 10);
  assert.deepEqual(parsed.grade.allowedWrites, ['src/a.js']);
});

test('parseCase accepts version 2 semantics and file checks', () => {
  const parsed = parseCase(validV2, 'case.json', '/case');
  assert.equal(parsed.schemaVersion, 2);
  if (parsed.schemaVersion !== 2) assert.fail('expected version 2');
  assert.equal(parsed.primaryQuality, 'task-effectiveness');
  assert.deepEqual(parsed.supportingQualities, ['change-discipline']);
  assert.deepEqual(parsed.grade.checks, validV2.grade.checks);
});

test('parseCase rejects agent fields, unknown checks, and invalid limits', () => {
  assert.throws(
    () => parseCase({...valid, model: 'private'}, 'case.json', '/case'),
    /fields must be exactly/,
  );
  assert.throws(
    () =>
      parseCase(
        {...valid, task: {...valid.task, maxSeconds: 0}},
        'case.json',
        '/case',
      ),
    /positive integer/,
  );
  assert.throws(
    () =>
      parseCase(
        {...valid, grade: {...valid.grade, checks: [{kind: 'contains', path: 'a'}]}},
        'case.json',
        '/case',
      ),
    /must be exists, exit0, or unchanged/,
  );
});

test('case versions reject fields and checks from the other contract', () => {
  assert.throws(
    () => parseCase({...valid, level: 'focused'}, 'case.json', '/case'),
    /fields must be exactly/,
  );
  assert.throws(
    () => parseCase({...validV2, category: 'edit'}, 'case.json', '/case'),
    /fields must be exactly/,
  );
  assert.throws(
    () => parseCase({...valid, grade: {...valid.grade, checks: [{kind: 'absent', path: 'a'}]}}, 'case.json', '/case'),
    /must be exists, exit0, or unchanged/,
  );
});

test('version 2 validates controlled semantics, uniqueness, and regular expressions', () => {
  assert.throws(
    () => parseCase({...validV2, level: 'journey'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({...validV2, primaryQuality: 'speed'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({...validV2, supportingQualities: ['change-discipline', 'change-discipline']}, 'case.json', '/case'),
    /must not contain duplicates/,
  );
  assert.throws(
    () => parseCase({...validV2, supportingQualities: ['task-effectiveness']}, 'case.json', '/case'),
    /must not repeat primaryQuality/,
  );
  assert.throws(
    () => parseCase({...validV2, startState: 'broken'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({...validV2, grade: {...validV2.grade, checks: [{kind: 'matches', path: 'a', pattern: '['}]}}, 'case.json', '/case'),
    /valid JavaScript regular expression/,
  );
  assert.throws(
    () => parseCase({...validV2, grade: {...validV2.grade, checks: [{kind: 'contains', path: 'a', text: ''}]}}, 'case.json', '/case'),
    /non-empty string/,
  );
});

test('parseSuite preserves profile order and rejects malformed profiles', () => {
  const cases = [parseCase(validV2, 'case.json', '/case')];
  const manifest = {
    schemaVersion: 1,
    id: 'portable',
    profiles: [
      {id: 'smoke-v1', caseIds: ['sample-v2'], repeats: 1},
      {id: 'foundation-v1', caseIds: ['sample-v2'], repeats: 3},
    ],
  };
  const parsed = parseSuite(manifest, 'suite.json', '/suite', cases);
  assert.deepEqual(parsed.profiles.map((profile) => profile.id), ['smoke-v1', 'foundation-v1']);
  assert.throws(
    () => parseSuite({...manifest, extra: true}, 'suite.json', '/suite', cases),
    /fields must be exactly/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [{id: 'bad id', caseIds: ['sample-v2'], repeats: 1}]}, 'suite.json', '/suite', cases),
    /kebab-case/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [{id: 'smoke-v1', caseIds: [], repeats: 1}]}, 'suite.json', '/suite', cases),
    /non-empty array/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [{id: 'smoke-v1', caseIds: ['missing'], repeats: 1}]}, 'suite.json', '/suite', cases),
    /unknown case/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [{id: 'smoke-v1', caseIds: ['sample-v2', 'sample-v2'], repeats: 1}]}, 'suite.json', '/suite', cases),
    /duplicates/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [{id: 'smoke-v1', caseIds: ['sample-v2'], repeats: 0}]}, 'suite.json', '/suite', cases),
    /positive integer/,
  );
  assert.throws(
    () => parseSuite({...manifest, profiles: [manifest.profiles[0], manifest.profiles[0]]}, 'suite.json', '/suite', cases),
    /duplicate profile ids/,
  );
});

test('parseSuite rejects version 1 cases from conformance profiles', () => {
  const legacy = parseCase(valid, 'case.json', '/case');
  assert.throws(
    () => parseSuite(
      {schemaVersion: 1, id: 'portable', profiles: [{id: 'smoke-v1', caseIds: ['sample'], repeats: 1}]},
      'suite.json',
      '/suite',
      [legacy],
    ),
    /version 1 case without conformance semantics/,
  );
});

test('safeRelativePath rejects empty, absolute, traversal, and non-normal paths', () => {
  for (const path of ['', '/tmp/a', '../a', 'a/../b', './a', 'a//b', 'C:\\a', 'a\\b']) {
    assert.throws(() => safeRelativePath('path', path), CaseError);
  }
  assert.equal(safeRelativePath('path', 'src/a.js'), 'src/a.js');
});

function caseDirectory(root: string, name: string, id: string): string {
  const dir = join(root, name);
  for (const child of ['workspace', 'solution', 'counterexample']) {
    mkdirSync(join(dir, child), {recursive: true});
    writeFileSync(join(dir, child, 'file.txt'), child);
  }
  writeFileSync(join(dir, 'case.json'), JSON.stringify({...valid, id}));
  return dir;
}

test('loadCase rejects fixture symlinks and loadCases rejects duplicate ids', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-cases-'));
  try {
    const linked = caseDirectory(root, 'linked', 'linked');
    symlinkSync(join(linked, 'workspace', 'file.txt'), join(linked, 'solution', 'link'));
    assert.throws(() => loadCase(linked), /symlinks are not allowed/);
    rmSync(linked, {recursive: true, force: true});
    caseDirectory(root, 'one', 'same');
    caseDirectory(root, 'two', 'same');
    assert.throws(() => loadCases(root), /duplicate case id/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('loadCase requires all fixture directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-case-'));
  try {
    mkdirSync(join(root, 'workspace'));
    writeFileSync(join(root, 'case.json'), JSON.stringify(valid));
    assert.throws(() => loadCase(root), /solution\/ is required/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
