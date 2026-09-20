import assert from 'node:assert/strict';
import test from 'node:test';
import {startApp} from '../src/app.js';
import {activatePlugin} from '../src/plugin.js';

test('existing retry behavior remains stable', () => {
  assert.equal(startApp().retries, 2);
  assert.equal(startApp(['--retries', '7']).retries, 7);
  assert.equal(activatePlugin({retries: 4}).retries, 4);
});
