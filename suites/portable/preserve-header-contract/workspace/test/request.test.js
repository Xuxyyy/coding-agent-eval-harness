import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequest} from '../src/index.js';

test('request construction preserves its public shape and non-conflicting headers', () => {
  assert.deepEqual(
    createRequest('https://example.test/items', {
      method: 'POST',
      headers: {'X-Trace-Id': 'trace-123'},
    }),
    {
      method: 'POST',
      url: 'https://example.test/items',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'portable-client/1.0',
        'X-Trace-Id': 'trace-123',
      },
    },
  );
});
