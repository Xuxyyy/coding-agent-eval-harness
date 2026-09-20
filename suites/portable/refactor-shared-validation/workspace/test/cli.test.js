import assert from 'node:assert/strict';
import test from 'node:test';
import {parseUser} from '../src/index.js';

test('CLI preserves result shapes and ordered messages', () => {
  assert.deepEqual(parseUser({username: 'ada', role: 'member'}), {
    ok: true, value: {username: 'ada', role: 'member'},
  });
  assert.deepEqual(parseUser({username: '!', role: 'owner'}), {
    ok: false, errors: ['username is invalid', 'role is invalid'],
  });
});
