import {readFileSync, writeFileSync} from 'node:fs';
import {OPTION_DEFAULTS} from '../definitions/options.js';

const target = new URL('../src/options.generated.js', import.meta.url);
const output = `export const DEFAULT_OPTIONS = ${JSON.stringify(OPTION_DEFAULTS, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) process.exitCode = 1;
} else {
  writeFileSync(target, output);
}
