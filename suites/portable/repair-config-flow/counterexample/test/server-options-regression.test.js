import assert from 'node:assert/strict';
import test from 'node:test';
import {buildServerOptions} from '../src/server-options.js';

test('server options prefer the reported environment port', () => {
  assert.equal(
    buildServerOptions({project: {port: 4100}, environment: {port: 5200}}).port,
    5200,
  );
});
