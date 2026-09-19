import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequest} from '../src/index.js';

test('reported header appears once with the caller value', () => {
  const request = createRequest('https://example.test/items', {
    headers: {accept: 'text/plain'},
  });
  assert.equal(request.headers.accept, 'text/plain');
  assert.equal(Object.keys(request.headers).filter((key) => key.toLowerCase() === 'accept').length, 1);
});
