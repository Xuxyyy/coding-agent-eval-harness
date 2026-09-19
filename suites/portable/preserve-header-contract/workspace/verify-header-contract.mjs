import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequest} from './src/index.js';
import {mergeHeaders} from './src/merge-headers.js';

const defaults = Object.freeze({Accept: 'application/json', 'X-Default': 'kept'});
const caller = Object.freeze({accept: 'text/plain', 'X-Caller': 'present'});
const merged = mergeHeaders(defaults, caller);
assert.deepEqual(merged, {
  'X-Default': 'kept',
  accept: 'text/plain',
  'X-Caller': 'present',
});
assert.equal(
  Object.keys(merged).map((key) => key.toLowerCase()).length,
  new Set(Object.keys(merged).map((key) => key.toLowerCase())).size,
);
assert.deepEqual(mergeHeaders({}, {'Caller-Only': 'value'}), {'Caller-Only': 'value'});
assert.deepEqual(mergeHeaders({'Default-Only': 'value'}, {}), {'Default-Only': 'value'});
assert.deepEqual(
  mergeHeaders({'X-Mode': 'default'}, {'x-mode': 'first', 'X-MODE': 'last'}),
  {'X-MODE': 'last'},
);
assert.deepEqual(Object.keys(createRequest('https://example.test')).sort(), ['headers', 'method', 'url']);

const implementationPath = new URL('./src/merge-headers.js', import.meta.url);
const regressionPath = new URL('./test/header-case-regression.test.js', import.meta.url);
const originalImplementation = readFileSync(implementationPath, 'utf8');
try {
  writeFileSync(
    implementationPath,
    'export function mergeHeaders(defaultHeaders = {}, callerHeaders = {}) { return {...defaultHeaders, ...callerHeaders}; }\n',
  );
  const regression = spawnSync(
    process.execPath,
    ['--test', new URL(regressionPath).pathname],
    {cwd: new URL('.', import.meta.url), encoding: 'utf8'},
  );
  assert.notEqual(regression.status, 0, 'regression test must reject case-sensitive merging');
} finally {
  writeFileSync(implementationPath, originalImplementation);
}
