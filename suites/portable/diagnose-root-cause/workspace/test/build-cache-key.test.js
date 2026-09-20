import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCacheKey} from '../src/build-cache-key.js';

test('encoded slash remains inside one route segment', () => {
  assert.equal(buildCacheKey('/users/a%2Fb/profile'), 'users|a/b|profile');
});
