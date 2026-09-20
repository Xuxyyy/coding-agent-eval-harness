import {formatRecord} from './packages/core/src/index.js';
import {render} from './packages/cli/src/render.js';
import {activate} from './packages/plugin/src/activate.js';
import {start} from './packages/app/src/start.js';

if (formatRecord({prefix: 'core', value: ' x '}) !== 'core:x') process.exit(1);
let rejected = false;
try { formatRecord('core', 'x'); } catch (error) { rejected = error instanceof TypeError; }
if (!rejected) process.exit(1);
if (render(' a ') !== 'cli:a' || activate(' b ') !== 'plugin:b' || start(' c ') !== 'app:c') process.exit(1);
