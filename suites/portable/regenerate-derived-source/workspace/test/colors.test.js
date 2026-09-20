import assert from 'node:assert/strict';
import test from 'node:test';
import {COLORS} from '../src/colors.generated.js';

test('blue is a supported public color', () => {
  assert.equal(COLORS.includes('blue'), true);
});
