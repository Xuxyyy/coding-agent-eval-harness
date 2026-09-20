import assert from 'node:assert/strict';
import test from 'node:test';
import {formatRecord} from '../packages/core/src/index.js';
test('options-object core behavior', () => assert.equal(formatRecord({prefix: 'core', value: ' x '}), 'core:x'));
