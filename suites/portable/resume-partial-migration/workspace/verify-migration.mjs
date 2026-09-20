import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderEntry} from './packages/core/src/render-entry.js';

assert.equal(renderEntry({prefix: 'x', value: 'y'}), 'x: y');
assert.throws(() => renderEntry('x', 'y'), /requires prefix and value/);
for (const path of ['packages/plugin/src/activate.js', 'packages/app/src/start.js']) {
  const source = await readFile(path, 'utf8');
  assert.match(source, /renderEntry\(\{prefix:/);
}
