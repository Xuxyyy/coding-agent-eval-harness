import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyTrial} from '../../src/graders/classify-trial.js';

test('classifyTrial separates pass, capability fail, and harness error', () => {
  assert.equal(classifyTrial('completed', true, true), 'pass');
  assert.equal(classifyTrial('completed', false, true), 'fail');
  assert.equal(classifyTrial('completed', true, false), 'fail');
  assert.equal(classifyTrial('denied', true, true), 'fail');
  assert.equal(classifyTrial('completed', true, true, 'fixture failed'), 'error');
  assert.equal(classifyTrial('error', false, false), 'error');
});
