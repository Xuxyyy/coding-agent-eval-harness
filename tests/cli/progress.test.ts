import assert from 'node:assert/strict';
import test from 'node:test';
import {formatSpinnerLine} from '../../src/cli/progress.js';

test('spinner line keeps status text white and dims elapsed time when enabled', () => {
  assert.equal(
    formatSpinnerLine('⠼', 'create-to-spec (repeat 1)', '3.6', false),
    '⠼ Running create-to-spec (repeat 1) · 3.6s',
  );
  assert.equal(
    formatSpinnerLine('⠼', 'create-to-spec (repeat 1)', '3.6', true),
    '⠼ Running create-to-spec (repeat 1) \u001b[2m· 3.6s\u001b[0m',
  );
});
