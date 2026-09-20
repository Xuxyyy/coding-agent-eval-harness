import {writeFileSync} from 'node:fs';
import {colors} from '../definitions/colors.js';

writeFileSync('src/colors.generated.js', `export const COLORS = ${JSON.stringify(colors)};\n`);
