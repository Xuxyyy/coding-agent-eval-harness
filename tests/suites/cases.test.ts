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

const validV3 = {
  ...validV2,
  schemaVersion: 3,
  id: 'sample-v3',
  expectedDisposition: 'implemented',
  trialChecks: {
    finalResponse: {required: ['src/a\\.js'], forbidden: ['type.?check passed']},
    controlledEvents: [
      {probeId: 'verification', command: 'node --test', outcomes: ['transient-failure', 'passed']},
    ],
  },
};

const validV4 = {
  ...validV3,
  schemaVersion: 4,
  id: 'sample-v4',
  primaryModule: 'recovery',
  horizon: 'multi-stage',
  trialChecks: {
    finalResponse: {required: ['fallback'], forbidden: []},
    controlledEvents: [
      {
        probeId: 'verification', strategy: 'unavailable', match: 'exact',
        outcomes: ['unavailable'],
      },
    ],
  },
};

const validV5 = {
  ...validV4,
  schemaVersion: 5,
  id: 'sample-v5',
  tier: 'baseline',
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

test('parseCase accepts version 3 dispositions and trial checks', () => {
  const parsed = parseCase(validV3, 'case.json', '/case');
  assert.equal(parsed.schemaVersion, 3);
  if (parsed.schemaVersion !== 3) assert.fail('expected version 3');
  assert.equal(parsed.expectedDisposition, 'implemented');
  assert.deepEqual(parsed.trialChecks.controlledEvents[0]?.outcomes, ['transient-failure', 'passed']);
});

test('parseCase accepts version 4 modules, horizons, and probe strategies', () => {
  const parsed = parseCase(validV4, 'case.json', '/case');
  assert.equal(parsed.schemaVersion, 4);
  if (parsed.schemaVersion !== 4) assert.fail('expected version 4');
  assert.equal(parsed.primaryModule, 'recovery');
  assert.equal(parsed.horizon, 'multi-stage');
  assert.deepEqual(parsed.trialChecks.controlledEvents[0], {
    probeId: 'verification', command: null, strategy: 'unavailable',
    match: 'exact', outcomes: ['unavailable'],
  });
  assert.throws(
    () => parseCase({...validV4, primaryModule: 'memory'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({...validV4, horizon: 'forever'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({
      ...validV4,
      trialChecks: {
        ...validV4.trialChecks,
        controlledEvents: [{
          probeId: 'verification', strategy: 'command', match: 'exact',
          command: 'node --test', outcomes: ['unavailable'],
        }],
      },
    }, 'case.json', '/case'),
    /command probes may expect only passed or failed/,
  );
});

test('parseCase accepts version 5 tiers and rejects invalid tier values', () => {
  const parsed = parseCase(validV5, 'case.json', '/case');
  assert.equal(parsed.schemaVersion, 5);
  if (parsed.schemaVersion !== 5) assert.fail('expected version 5');
  assert.equal(parsed.tier, 'baseline');
  assert.equal(parsed.primaryModule, 'recovery');
  assert.throws(
    () => parseCase({...validV5, tier: 'advanced'}, 'case.json', '/case'),
    /must be one of/,
  );
});

test('version 3 rejects malformed trial facts, probes, and unsupported combinations', () => {
  assert.throws(
    () => parseCase({...validV3, expectedDisposition: 'guessed'}, 'case.json', '/case'),
    /must be one of/,
  );
  assert.throws(
    () => parseCase({...validV3, trialChecks: {finalResponse: {required: ['['], forbidden: []}, controlledEvents: []}}, 'case.json', '/case'),
    /valid JavaScript regular expression/,
  );
  assert.throws(
    () => parseCase({...validV3, trialChecks: {finalResponse: {required: [], forbidden: []}, controlledEvents: []}}, 'case.json', '/case'),
    /at least one trial check/,
  );
  assert.throws(
    () => parseCase({...validV3, trialChecks: {...validV3.trialChecks, controlledEvents: [validV3.trialChecks.controlledEvents[0], validV3.trialChecks.controlledEvents[0]]}}, 'case.json', '/case'),
    /duplicate probe IDs/,
  );
  assert.throws(
    () => parseCase({...validV3, expectedDisposition: 'blocked'}, 'case.json', '/case'),
    /unsupported for blocked/,
  );
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
  if (!('profiles' in parsed)) assert.fail('expected profile suite');
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

test('parseSuite version 3 preserves exact case order and requires every version 5 case', () => {
  const first = parseCase(validV5, 'first.json', '/first');
  const second = parseCase({...validV5, id: 'second-v5', tier: 'challenge'}, 'second.json', '/second');
  const cases = [first, second];
  const manifest = {
    schemaVersion: 3,
    id: 'portable',
    caseOrder: ['second-v5', 'sample-v5'],
  };
  const parsed = parseSuite(manifest, 'suite.json', '/suite', cases);
  assert.equal(parsed.schemaVersion, 3);
  if (parsed.schemaVersion !== 3) assert.fail('expected ordered suite');
  assert.deepEqual(parsed.caseOrder, ['second-v5', 'sample-v5']);
  assert.throws(
    () => parseSuite({...manifest, caseOrder: ['sample-v5']}, 'suite.json', '/suite', cases),
    /every version 5 case exactly once/,
  );
  assert.throws(
    () => parseSuite({...manifest, caseOrder: ['sample-v5', 'sample-v5']}, 'suite.json', '/suite', cases),
    /duplicates/,
  );
  assert.throws(
    () => parseSuite(manifest, 'suite.json', '/suite', [parseCase(validV4, 'old.json', '/old')]),
    /unknown case|every version 5 case/,
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

test('loadCase requires and validates version 3 evidence fixtures', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-case-v3-'));
  try {
    for (const child of ['workspace', 'solution', 'counterexample']) mkdirSync(join(root, child));
    writeFileSync(join(root, 'case.json'), JSON.stringify(validV3));
    assert.throws(() => loadCase(root), /evidence\/ is required/);
    mkdirSync(join(root, 'evidence'));
    const evidence = {
      terminalStatus: 'completed',
      finalMessage: 'src/a.js; node --test passed after retry',
      controlledEvents: [
        {sequence: 1, probeId: 'verification', outcome: 'transient-failure'},
        {sequence: 2, probeId: 'verification', outcome: 'passed'},
      ],
    };
    writeFileSync(join(root, 'evidence', 'known-good.json'), JSON.stringify(evidence));
    writeFileSync(join(root, 'evidence', 'known-bad.json'), JSON.stringify({...evidence, finalMessage: null}));
    const loaded = loadCase(root);
    assert.equal(loaded.schemaVersion, 3);
    if (loaded.schemaVersion === 3) assert.equal(loaded.evidence.knownGood.controlledEvents.length, 2);
    writeFileSync(join(root, 'evidence', 'known-bad.json'), '{');
    assert.throws(() => loadCase(root), /invalid JSON/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
