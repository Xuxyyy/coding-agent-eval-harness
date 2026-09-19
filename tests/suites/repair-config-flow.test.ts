import assert from 'node:assert/strict';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {applyOverlay, createFixture, removeFixture} from '../../src/environments/fixture.js';
import {gradeCase} from '../../src/graders/grade-case.js';
import {loadCases} from '../../src/suites/cases.js';

const suiteRoot = resolve('suites/portable');

function definition() {
  const found = loadCases(suiteRoot).find((item) => item.id === 'repair-config-flow');
  assert.ok(found);
  return found;
}

test('repair-config-flow initial, solution, and shortcut states match the admission record', () => {
  const workflow = definition();
  for (const [overlay, expected] of [
    [undefined, {solved: false, clean: true}],
    ['solution', {solved: true, clean: true}],
    ['counterexample', {solved: false, clean: true}],
  ] as const) {
    const fixture = createFixture(workflow);
    try {
      if (overlay !== undefined) applyOverlay(workflow, fixture.root, overlay);
      const resolverPath = resolve(fixture.root, 'src/resolve-config.js');
      const serverOptionsPath = resolve(fixture.root, 'src/server-options.js');
      const resolverBefore = readFileSync(resolverPath, 'utf8');
      const serverOptionsBefore = readFileSync(serverOptionsPath, 'utf8');
      const grade = gradeCase(workflow, fixture.root, fixture.before);
      assert.equal(grade.solved, expected.solved, `${overlay ?? 'initial'} solved`);
      assert.equal(grade.clean, expected.clean, `${overlay ?? 'initial'} clean`);
      assert.equal(readFileSync(resolverPath, 'utf8'), resolverBefore, 'resolver mutation restored');
      assert.equal(
        readFileSync(serverOptionsPath, 'utf8'),
        serverOptionsBefore,
        'consumer mutation restored',
      );
      if (overlay !== undefined) {
        assert.deepEqual(
          [...grade.changes.added, ...grade.changes.modified, ...grade.changes.deleted].sort(),
          ['src/server-options.js', 'test/server-options-regression.test.js'],
        );
      }
    } finally {
      assert.equal(removeFixture(fixture.root), true);
    }
  }
});

test('repair-config-flow accepts equivalent resolver routing without syntax coupling', () => {
  const workflow = definition();
  const fixture = createFixture(workflow);
  try {
    applyOverlay(workflow, fixture.root, 'solution');
    writeFileSync(
      resolve(fixture.root, 'src/server-options.js'),
      "import {resolveConfig as assemble} from './resolve-config.js';\n\n"
        + 'export function buildServerOptions(layers) {\n'
        + '  return {...assemble(layers)};\n'
        + '}\n',
    );
    const grade = gradeCase(workflow, fixture.root, fixture.before);
    assert.equal(grade.solved, true);
    assert.equal(grade.clean, true);
  } finally {
    assert.equal(removeFixture(fixture.root), true);
  }
});

test('repair-config-flow rejects realistic shortcuts and protection violations', () => {
  const workflow = definition();
  const probes: Array<{
    name: string;
    prepare: (root: string) => void;
  }> = [
    {
      name: 'comments only',
      prepare(root) {
        writeFileSync(resolve(root, 'src/server-options.js'), '// use the shared resolver\n');
      },
    },
    {
      name: 'hard-coded visible values',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(
          resolve(root, 'src/server-options.js'),
          "export function buildServerOptions() { return {host: 'environment.internal', port: 5200, logLevel: 'debug'}; }\n",
        );
      },
    },
    {
      name: 'existing test tampering',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'test/server-options.test.js'), '// removed assertion\n');
      },
    },
    {
      name: 'documentation rewrite',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'README.md'), '# Changed contract\n');
      },
    },
    {
      name: 'deleted existing test',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        rmSync(resolve(root, 'test/server-options.test.js'));
      },
    },
    {
      name: 'out-of-scope file',
      prepare(root) {
        applyOverlay(workflow, root, 'solution');
        writeFileSync(resolve(root, 'notes.txt'), 'unexpected\n');
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
