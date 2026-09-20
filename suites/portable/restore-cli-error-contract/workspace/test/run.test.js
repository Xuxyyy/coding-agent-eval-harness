import assert from 'node:assert/strict';
import test from 'node:test';
import {runCount} from '../src/run.js';
test('formats valid output', () => assert.equal(runCount(3), 'count:3'));
