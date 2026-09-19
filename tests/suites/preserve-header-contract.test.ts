import assert from 'node:assert/strict';
import {rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {loadCases} from '../../src/suites/cases.js';

const suiteRoot = resolve('suites/portable');

function definition() {
  const found = loadCases(suiteRoot).find((item) => item.id === 'preserve-header-contract');
  assert.ok(found);
  return found;
}

test('preserve-header-contract initial, solution, and shortcut states match the admission record', () => {
  const workflow = definition();
  for (const [overlay, expected] of [
    [undefined, {solved: false, clean: true}],
    ['solution', {solved: true, clean: true}],
    ['counterexample', {solved: false, clean: true}],
  ] as const) {
    const fixture = createFixture(workflow);
    try {
      if (overlay !== undefined) applyOverlay(workflow, fixture.root, overlay);
      const grade = gradeCase(workflow, fixture.root, fixture.before);
      assert.equal(grade.solved, expected.solved, `${overlay ?? 'initial'} solved`);
      assert.equal(grade.clean, expected.clean, `${overlay ?? 'initial'} clean`);
      if (overlay !== undefined) {
        assert.deepEqual(
          [...grade.changes.added, ...grade.changes.modified, ...grade.changes.deleted].sort(),
          ['src/merge-headers.js', 'test/header-case-regression.test.js'],
        );
      }
    } finally {
      assert.equal(removeFixture(fixture.root), true);
    }
  }
});

test('preserve-header-contract accepts an equivalent immutable merge', () => {
  const workflow = definition();
  const fixture = createFixture(workflow);
  try {
    applyOverlay(workflow, fixture.root, 'solution');
    writeFileSync(
      resolve(fixture.root, 'src/merge-headers.js'),
      'export function mergeHeaders(defaults = {}, caller = {}) {\n'
        + '  const output = {};\n'
        + '  for (const source of [defaults, caller]) {\n'
        + '    for (const [key, value] of Object.entries(source)) {\n'
        + '      const previous = Object.keys(output).find((item) => item.toLowerCase() === key.toLowerCase());\n'
        + '      if (previous !== undefined) delete output[previous];\n'
        + '      output[key] = value;\n'
        + '    }\n'
        + '  }\n'
        + '  return output;\n'
        + '}\n',
    );
    const grade = gradeCase(workflow, fixture.root, fixture.before);
    assert.equal(grade.solved, true);
    assert.equal(grade.clean, true);
  } finally {
    assert.equal(removeFixture(fixture.root), true);
  }
});

test('preserve-header-contract rejects shortcuts, mutation, and broader churn', () => {
  const workflow = definition();
  const probes: Array<{
    name: string;
    prepare: (root: string) => void;
  }> = [
    {
      name: 'comments only',
      prepare(root) {
        writeFileSync(resolve(root, 'src/merge-headers.js'), '// merge without duplicates\n');
      },
    },
    {
      name: 'lowercase normalization',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(
          resolve(root, 'src/merge-headers.js'),
          'export function mergeHeaders(defaults = {}, caller = {}) { return Object.fromEntries(Object.entries({...defaults, ...caller}).map(([key, value]) => [key.toLowerCase(), value])); }\n',
        );
      },
    },
    {
      name: 'caller mutation',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(
          resolve(root, 'src/merge-headers.js'),
          'export function mergeHeaders(defaults = {}, caller = {}) { Object.assign(caller, defaults, caller); return caller; }\n',
        );
      },
    },
    {
      name: 'existing test tampering',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'test/request.test.js'), '// removed assertion\n');
      },
    },
    {
      name: 'public boundary rewrite',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'src/index.js'), "export * from './merge-headers.js';\n");
      },
    },
    {
      name: 'deleted existing test',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        rmSync(resolve(root, 'test/request.test.js'));
      },
    },
    {
      name: 'out-of-scope file',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'debug.txt'), 'unexpected\n');
      },
    },
  ];

  for (const probe of probes) {
    const fixture = createFixture(workflow);
    try {
      probe.prepare(fixture.root);
      const grade = gradeCase(workflow, fixture.root, fixture.before);
      assert.equal(grade.solved && grade.clean, false, probe.name);
    } finally {
      assert.equal(removeFixture(fixture.root), true);
    }
  }
});
