import assert from 'node:assert/strict';
import test from 'node:test';
import {parsePort} from '../src/parse-port.js';

test('rejects trailing non-digits from the reported input', () => {
  assert.equal(parsePort('8080oops'), null);
});
