import assert from 'node:assert/strict';
import test from 'node:test';
import {renderCli} from '../packages/cli/src/render.js';
import {activate} from '../packages/plugin/src/activate.js';
import {start} from '../packages/app/src/start.js';

test('all consumers use the migrated API', () => {
  assert.equal(renderCli('one'), 'cli: one');
  assert.equal(activate('two'), 'plugin: two');
  assert.equal(start('three'), 'app: three');
});
