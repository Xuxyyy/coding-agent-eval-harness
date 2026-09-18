import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const path = 'src/constants.js';
const original = readFileSync(path, 'utf8');

try {
  writeFileSync(path, "export const WORD_SEPARATOR = '~';\n");
  const {normalizeTitle} = await import(`./src/title.js?probe=${Date.now()}`);
  assert.equal(normalizeTitle('  Release   Notes  '), 'release~notes');
} finally {
  writeFileSync(path, original);
}
