import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const implementation = 'src/find-user.js';
const before = readFileSync(implementation, 'utf8');
try {
  writeFileSync(implementation, `export function findUser(users, id) {
  return users.find((user) => user.id === id);
}
`);
  const mutated = spawnSync(process.execPath, ['--test', 'test/find-user.test.js'], {stdio: 'ignore'});
  if (mutated.status === 0) process.exitCode = 1;
} finally {
  writeFileSync(implementation, before);
}
