import assert from 'node:assert/strict';
import test from 'node:test';
import {startApp} from '../src/app.js';
import {activatePlugin} from '../src/plugin.js';

test('timeout follows default, config, environment, and CLI precedence', () => {
  assert.equal(startApp().timeoutMs, 5000);
  assert.equal(startApp([], {requestTimeoutMs: 6000}).timeoutMs, 6000);
  assert.equal(startApp([], {requestTimeoutMs: 6000}, {TOOL_TIMEOUT_MS: '7000'}).timeoutMs, 7000);
  assert.equal(startApp(['--timeout', '8000'], {}, {TOOL_TIMEOUT_MS: '7000'}).timeoutMs, 8000);
  assert.equal(activatePlugin({requestTimeoutMs: 6000}).timeoutMs, 6000);
});
