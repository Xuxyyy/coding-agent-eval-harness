import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const shared = 'src/shared/validate-user.js';
let before;
try {
  before = readFileSync(shared, 'utf8');
} catch {
  process.exit(1);
}

try {
  writeFileSync(shared, "export function validateUser() { return ['sentinel validation']; }\n");
  const api = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import {createUser} from './src/api/create-user.js'; try { createUser({username:'ada',role:'admin'}); process.exit(1) } catch (e) { if (e.messages?.[0] !== 'sentinel validation') process.exit(1) }",
  ]);
  const cli = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import {parseUser} from './src/cli/parse-user.js'; const r=parseUser({username:'ada',role:'admin'}); if (r.errors?.[0] !== 'sentinel validation') process.exit(1)",
  ]);
  if (api.status !== 0 || cli.status !== 0) process.exitCode = 1;
} finally {
  writeFileSync(shared, before);
}
