import assert from 'node:assert/strict';
import test from 'node:test';
import {findUser} from '../src/find-user.js';

test('returns a matching user', () => {
  const ada = {id: 'ada', name: 'Ada'};
  assert.equal(findUser([ada], 'ada'), ada);
});

test('returns the missing-user sentinel', () => {
  assert.equal(findUser([], 'missing'), null);
});
