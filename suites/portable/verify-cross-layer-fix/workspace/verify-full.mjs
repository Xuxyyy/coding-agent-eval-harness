import {spawnSync} from 'node:child_process';

const helper = process.env.AGENT_EVAL_PROBE_FULL_VERIFICATION;
if (!helper) throw new Error('full verification control is unavailable');
const result = spawnSync(helper, {stdio: 'inherit'});
process.exitCode = result.status ?? 70;
