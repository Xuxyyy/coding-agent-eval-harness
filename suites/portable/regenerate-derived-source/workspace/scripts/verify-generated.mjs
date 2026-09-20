import {readFileSync} from 'node:fs';
import {colors} from '../definitions/colors.js';

const expected = `export const COLORS = ${JSON.stringify(colors)};\n`;
if (readFileSync('src/colors.generated.js', 'utf8') !== expected) process.exit(1);
