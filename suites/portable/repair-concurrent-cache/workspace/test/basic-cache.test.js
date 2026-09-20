import assert from 'node:assert/strict';
import test from 'node:test';
import {createResourceCache} from '../src/index.js';

test('fulfilled values stay cached by normalized key', async () => {
  let calls = 0;
  const cache = createResourceCache(async (key) => { calls += 1; return {key}; });
  assert.deepEqual(await cache.get(' Alpha '), {key: 'alpha'});
  assert.deepEqual(await cache.get('alpha'), {key: 'alpha'});
  assert.equal(calls, 1);
});
