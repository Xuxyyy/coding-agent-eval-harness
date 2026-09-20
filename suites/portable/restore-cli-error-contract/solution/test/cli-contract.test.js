import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('invalid input preserves the public process contract', () => {
  const result = spawnSync(process.execPath, ['bin/tool.js', '--count', 'bad'], {encoding: 'utf8'});
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'error: --count must be an integer\n');
});
