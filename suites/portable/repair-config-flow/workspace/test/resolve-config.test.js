import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveConfig} from '../src/resolve-config.js';

test('environment values override project values and defaults', () => {
  assert.deepEqual(
    resolveConfig({
      project: {host: 'project.internal', port: 4100, logLevel: 'warn'},
      environment: {port: 5200},
    }),
    {host: 'project.internal', port: 5200, logLevel: 'warn'},
  );
});

test('defaults fill values omitted by both layers', () => {
  assert.deepEqual(resolveConfig(), {
    host: '127.0.0.1',
    port: 3000,
    logLevel: 'info',
  });
});
