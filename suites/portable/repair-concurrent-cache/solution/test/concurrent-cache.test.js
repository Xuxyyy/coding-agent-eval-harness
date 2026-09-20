import assert from 'node:assert/strict';
import test from 'node:test';
import {createResourceCache} from '../src/resource-cache.js';

test('shares concurrent work and retries after rejection', async () => {
  let attempts = 0;
  let release;
  const cache = createResourceCache(() => {
    attempts += 1;
    if (attempts === 1) return Promise.reject(new Error('temporary'));
    return new Promise((resolve) => { release = resolve; });
  });
  await assert.rejects(cache.get('item'), /temporary/);
  const first = cache.get('item');
  const second = cache.get('item');
  await Promise.resolve();
  assert.equal(attempts, 2);
  release('ready');
  assert.deepEqual(await Promise.all([first, second]), ['ready', 'ready']);
});
