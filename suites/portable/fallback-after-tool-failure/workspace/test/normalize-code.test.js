import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeCode} from '../src/normalize-code.js';

test('normalizes external codes', () => {
  assert.equal(normalizeCode(' ab-12 '), 'AB-12');
});
