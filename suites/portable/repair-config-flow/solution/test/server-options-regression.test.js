import assert from 'node:assert/strict';
import test from 'node:test';
import {buildServerOptions} from '../src/server-options.js';

test('server options consume the complete resolved configuration', () => {
  assert.deepEqual(
    buildServerOptions({
      project: {host: 'project.internal', port: 4100, logLevel: 'warn'},
      environment: {host: 'environment.internal', port: 5200, logLevel: 'debug'},
    }),
    {host: 'environment.internal', port: 5200, logLevel: 'debug'},
  );
});
