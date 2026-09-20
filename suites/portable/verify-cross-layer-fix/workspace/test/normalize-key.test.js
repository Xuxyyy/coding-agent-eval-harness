import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeKey} from '../src/normalize-key.js';

test('normalizes one key segment', () => {
  assert.equal(normalizeKey(' User-ID '), 'user-id');
});
