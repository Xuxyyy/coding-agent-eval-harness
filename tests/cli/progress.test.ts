import assert from 'node:assert/strict';
import test from 'node:test';
import {formatSpinnerLine} from '../../src/cli/progress.js';

test('spinner line uses subtle colors only when enabled', () => {
  assert.equal(
    formatSpinnerLine('⠼', 'create-to-spec (repeat 1)', '3.6', false),
    '⠼ Running create-to-spec (repeat 1) · 3.6s',
  );
  assert.equal(
    formatSpinnerLine('⠼', 'create-to-spec (repeat 1)', '3.6', true),
    '\u001b[36m⠼ Running\u001b[0m create-to-spec (repeat 1) \u001b[2m· 3.6s\u001b[0m',
  );
});
