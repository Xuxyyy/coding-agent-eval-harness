import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {startApp} from './src/app.js';
import {activatePlugin} from './src/plugin.js';

assert.deepEqual(startApp(), {retries: 2, timeoutMs: 5000});
assert.equal(startApp([], {requestTimeoutMs: 6000}).timeoutMs, 6000);
assert.equal(startApp([], {requestTimeoutMs: 6000}, {TOOL_TIMEOUT_MS: '7000'}).timeoutMs, 7000);
assert.equal(startApp(['--timeout', '8000'], {}, {TOOL_TIMEOUT_MS: '7000'}).timeoutMs, 8000);
assert.equal(activatePlugin({requestTimeoutMs: 6000}, {TOOL_TIMEOUT_MS: '7000'}).timeoutMs, 7000);
assert.equal(existsSync('test/timeout-regression.test.js'), true);
assert.match(readFileSync('test/timeout-regression.test.js', 'utf8'), /--timeout/);
const generated = spawnSync(process.execPath, ['scripts/generate-options.mjs', '--check']);
assert.equal(generated.status, 0);
