import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createResourceCache} from './src/resource-cache.js';

let resolveLoad;
let calls = 0;
const cache = createResourceCache(() => {
  calls += 1;
  return new Promise((resolve) => { resolveLoad = resolve; });
});
const first = cache.get('same');
const second = cache.get('same');
await Promise.resolve();
assert.equal(calls, 1);
resolveLoad({ok: true});
assert.deepEqual(await Promise.all([first, second]), [{ok: true}, {ok: true}]);

let attempts = 0;
const retrying = createResourceCache(async () => {
  attempts += 1;
  if (attempts === 1) throw new Error('temporary');
  return 'recovered';
});
await assert.rejects(retrying.get('retry'), /temporary/);
assert.equal(await retrying.get('retry'), 'recovered');
assert.equal(attempts, 2);

const implementationPath = 'src/inflight.js';
const before = readFileSync(implementationPath, 'utf8');
try {
  writeFileSync(implementationPath, `export function createInFlightTracker() {\n  const pending = new Map();\n  return {run(key, factory) {\n    if (!pending.has(key)) pending.set(key, Promise.resolve().then(factory));\n    return pending.get(key);\n  }};\n}\n`);
  const mutated = spawnSync(process.execPath, ['--test', 'test/concurrent-cache.test.js'], {stdio: 'ignore'});
  if (mutated.status === 0) process.exitCode = 1;
} finally {
  writeFileSync(implementationPath, before);
}
