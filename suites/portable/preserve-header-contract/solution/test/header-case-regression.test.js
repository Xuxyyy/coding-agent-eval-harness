import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequest} from '../src/index.js';

test('caller header replaces a differently cased default without duplication', () => {
  const callerHeaders = {accept: 'text/plain'};
  const request = createRequest('https://example.test/items', {headers: callerHeaders});

  assert.deepEqual(request.headers, {
    'User-Agent': 'portable-client/1.0',
    accept: 'text/plain',
  });
  assert.deepEqual(callerHeaders, {accept: 'text/plain'});
});
