import assert from 'node:assert/strict';
import test from 'node:test';
import {formatLabel} from '../src/format-label.js';

test('formats a display label', () => {
  assert.equal(formatLabel('  green ROOM  '), 'Green Room');
});
