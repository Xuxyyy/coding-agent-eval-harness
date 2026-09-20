import assert from 'node:assert/strict';
import test from 'node:test';
import {main} from '../src/cli.js';
test('main reports usage errors', async () => {
  let stderr = '';
  assert.equal(await main(['--count', 'bad'], {stdout: {write() {}}, stderr: {write: (v) => { stderr += v; }}}), 2);
  assert.match(stderr, /must be an integer/);
});
