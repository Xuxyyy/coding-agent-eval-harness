import assert from 'node:assert/strict';
import test from 'node:test';
import {formatValue} from '../src/index.js';

test('active replacement remains public', () => {
  assert.equal(formatValue(' value '), '[value]');
});
