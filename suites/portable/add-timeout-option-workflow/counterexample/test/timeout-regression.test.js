import assert from 'node:assert/strict';
import test from 'node:test';
import {startApp} from '../src/app.js';

test('CLI timeout reaches the app client', () => {
  assert.equal(startApp(['--timeout', '8000']).timeoutMs, 8000);
});
