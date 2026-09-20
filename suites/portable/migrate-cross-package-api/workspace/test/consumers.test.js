import assert from 'node:assert/strict';
import test from 'node:test';
import {render} from '../packages/cli/src/render.js';
import {activate} from '../packages/plugin/src/activate.js';
import {start} from '../packages/app/src/start.js';
test('package consumers', () => {
  assert.equal(render(' one '), 'cli:one');
  assert.equal(activate(' two '), 'plugin:two');
  assert.equal(start(' three '), 'app:three');
});
