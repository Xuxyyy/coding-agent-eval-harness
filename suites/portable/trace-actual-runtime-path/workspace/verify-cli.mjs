import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const result = spawnSync(process.execPath, ['bin/label-tool.js', 'Public Label'], {encoding: 'utf8'});
assert.equal(result.status, 0);
assert.equal(result.stderr, '');
assert.equal(result.stdout, 'public-label\n');
