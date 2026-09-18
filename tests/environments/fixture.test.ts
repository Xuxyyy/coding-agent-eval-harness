import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {loadCase} from '../../src/suites/cases.js';
import {
  applyOverlay,
  compareSnapshots,
  createFixture,
  hashFile,
  removeFixture,
  snapshot,
  writeFixtureFile,
} from '../../src/environments/fixture.js';

function makeCase(): {root: string; caseDir: string} {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-fixture-test-'));
  const caseDir = join(root, 'case');
  for (const child of ['workspace', 'solution', 'counterexample']) {
    mkdirSync(join(caseDir, child), {recursive: true});
  }
  writeFileSync(join(caseDir, 'workspace', 'a.txt'), 'before');
  writeFileSync(join(caseDir, 'solution', 'a.txt'), 'after');
  writeFileSync(join(caseDir, 'solution', 'b.txt'), 'added');
  writeFileSync(join(caseDir, 'solution', '.empty-overlay'), 'marker');
  writeFileSync(join(caseDir, 'counterexample', '.delete'), 'a.txt\n');
  writeFileSync(
    join(caseDir, 'case.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'fixture',
      category: 'edit',
      task: {prompt: 'edit', maxSeconds: 1},
      grade: {allowedWrites: ['a.txt'], checks: [{kind: 'exists', path: 'a.txt'}]},
    }),
  );
  return {root, caseDir};
}

test('fixture copy initializes Git, snapshots, applies overlays, and cleans up', () => {
  const made = makeCase();
  let fixture = '';
  try {
    const definition = loadCase(made.caseDir);
    const created = createFixture(definition);
    fixture = created.root;
    assert.equal(readFileSync(join(fixture, 'a.txt'), 'utf8'), 'before');
    assert.equal(existsSync(join(fixture, '.git')), true);
    assert.deepEqual([...created.before.keys()], ['a.txt']);

    applyOverlay(definition, fixture, 'solution');
    const changes = compareSnapshots(created.before, snapshot(fixture));
    assert.deepEqual(changes, {added: ['b.txt'], modified: ['a.txt'], deleted: []});
    assert.equal(existsSync(join(fixture, '.empty-overlay')), false);
    assert.equal(hashFile(join(fixture, 'a.txt')).length, 64);

    writeFixtureFile(fixture, 'nested/c.txt', 'content');
    assert.equal(readFileSync(join(fixture, 'nested/c.txt'), 'utf8'), 'content');
    applyOverlay(definition, fixture, 'counterexample');
    assert.equal(existsSync(join(fixture, 'a.txt')), false);
  } finally {
    if (fixture !== '') assert.equal(removeFixture(fixture), true);
    rmSync(made.root, {recursive: true, force: true});
  }
  assert.equal(existsSync(fixture), false);
});
