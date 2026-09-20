import assert from 'node:assert/strict';
import test from 'node:test';
import {formatLabel} from '../src/legacy/format-label.js';

test('legacy formatter remains available', () => {
  assert.equal(formatLabel(' Old Path '), 'old-path');
});
