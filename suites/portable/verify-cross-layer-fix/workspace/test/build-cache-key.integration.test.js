import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCacheKey} from '../src/build-cache-key.js';

test('normalizes both segments through the public consumer', () => {
  assert.equal(buildCacheKey(' Accounts ', ' User-ID '), 'accounts:user-id');
});
