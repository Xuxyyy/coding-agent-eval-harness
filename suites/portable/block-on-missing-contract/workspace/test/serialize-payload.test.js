import assert from 'node:assert/strict';
import test from 'node:test';
import {serializePayload} from '../src/serialize-payload.js';

test('does not guess the downstream contract', () => {
  assert.throws(() => serializePayload({id: 1}), /contract choice required/);
});
