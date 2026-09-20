import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCount} from '../src/parse-count.js';
test('parses integer counts', () => assert.equal(parseCount(['--count', '3']), 3));
