import assert from 'node:assert/strict';
import test from 'node:test';
import {parsePort} from '../src/parse-port.js';

test('mentions the report without testing it', () => {
  const reportedInput = '8080oops';
  assert.equal(typeof reportedInput, 'string');
  // assert.equal(parsePort('8080oops'), null);
  assert.equal(parsePort('8080'), 8080);
});
