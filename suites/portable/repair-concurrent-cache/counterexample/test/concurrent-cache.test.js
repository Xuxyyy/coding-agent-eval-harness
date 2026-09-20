import assert from 'node:assert/strict';
import test from 'node:test';
import {createResourceCache} from '../src/resource-cache.js';
test('shares concurrent work', async () => {
  let calls = 0;
  const cache = createResourceCache(async () => { calls += 1; return 'ok'; });
  assert.deepEqual(await Promise.all([cache.get('x'), cache.get('x')]), ['ok', 'ok']);
  assert.equal(calls, 1);
});
