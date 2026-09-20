import assert from 'node:assert/strict';
import test from 'node:test';
import {createUser, ValidationError} from '../src/index.js';

test('API preserves result and ordered messages', () => {
  assert.deepEqual(createUser({username: 'ada', role: 'admin'}), {username: 'ada', role: 'admin'});
  assert.throws(
    () => createUser({username: '', role: 'owner'}),
    (error) => error instanceof ValidationError
      && error.message === 'username is required; role is invalid'
      && error.messages.join('|') === 'username is required|role is invalid',
  );
});
