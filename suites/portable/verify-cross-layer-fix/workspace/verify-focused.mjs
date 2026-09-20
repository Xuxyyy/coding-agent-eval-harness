import {spawnSync} from 'node:child_process';

const helper = process.env.AGENT_EVAL_PROBE_FOCUSED_VERIFICATION;
if (!helper) throw new Error('focused verification control is unavailable');
const result = spawnSync(helper, {stdio: 'inherit'});
process.exitCode = result.status ?? 70;
