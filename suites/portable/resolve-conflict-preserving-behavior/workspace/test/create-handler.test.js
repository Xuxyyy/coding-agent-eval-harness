import assert from 'node:assert/strict';
import test from 'node:test';
import {createHandler} from '../src/create-handler.js';

test('preserves timeout and logging changes', async () => {
  const lines = [];
  const action = async (_request, context) => context.timeoutMs;
  const handler = createHandler(action, {timeoutMs: 250, log: (line) => lines.push(line)});
  assert.equal(await handler({method: 'POST', path: '/jobs'}), 250);
  assert.deepEqual(lines, ['POST /jobs']);
});

test('uses the default timeout', async () => {
  const handler = createHandler(async (_request, context) => context.timeoutMs);
  assert.equal(await handler({method: 'GET', path: '/'}), 5000);
});
