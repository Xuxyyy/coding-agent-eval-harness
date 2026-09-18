import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const path = 'src/parse-port.js';
const original = readFileSync(path, 'utf8');
const knownBad = `export function parsePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}
`;

try {
  writeFileSync(path, knownBad);
  const run = spawnSync(process.execPath, ['--test', 'test/parse-port-regression.test.js'], {
    encoding: 'utf8',
  });
  if (run.error || run.status === 0) process.exitCode = 1;
} finally {
  writeFileSync(path, original);
}
