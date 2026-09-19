import {spawnSync} from 'node:child_process';

const probe = process.env.AGENT_EVAL_PROBE_VERIFICATION;
if (!probe) {
  console.error('AGENT_EVAL_PROBE_VERIFICATION is unavailable');
  process.exit(2);
}
const result = spawnSync(probe, [], {stdio: 'inherit'});
process.exit(result.status ?? 1);
