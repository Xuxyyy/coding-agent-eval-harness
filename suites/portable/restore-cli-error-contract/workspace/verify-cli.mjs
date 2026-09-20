import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const invalid = spawnSync(process.execPath, ['bin/tool.js', '--count', 'nope'], {encoding: 'utf8'});
if (invalid.status !== 2 || invalid.stdout !== '' || invalid.stderr !== 'error: --count must be an integer\n') process.exit(1);
const valid = spawnSync(process.execPath, ['bin/tool.js', '--count', '4'], {encoding: 'utf8'});
if (valid.status !== 0 || valid.stdout !== 'count:4\n' || valid.stderr !== '') process.exit(1);

const bin = 'bin/tool.js';
const before = readFileSync(bin, 'utf8');
try {
  writeFileSync(bin, "#!/usr/bin/env node\nimport {main} from '../src/cli.js';\nawait main(process.argv.slice(2));\n");
  const mutated = spawnSync(process.execPath, ['--test', 'test/cli-contract.test.js'], {stdio: 'ignore'});
  if (mutated.status === 0) process.exitCode = 1;
} finally {
  writeFileSync(bin, before);
}
