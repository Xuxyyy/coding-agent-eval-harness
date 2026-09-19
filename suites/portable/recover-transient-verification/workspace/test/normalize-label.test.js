import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeLabel} from '../src/normalize-label.js';

test('normalizes surrounding and repeated whitespace', () => {
  assert.equal(normalizeLabel('  alpha   beta  '), 'alpha beta');
});
