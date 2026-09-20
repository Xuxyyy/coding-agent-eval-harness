import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import test from 'node:test';
import {createTrialControl} from '../../src/environments/trial-control.js';
import {runProcess} from '../../src/environments/process.js';
import {parseCase} from '../../src/suites/cases.js';

function definition() {
  const parsed = parseCase({
    schemaVersion: 3,
    id: 'control-case',
    level: 'focused',
    primaryQuality: 'recovery-resilience',
    supportingQualities: [],
    startState: 'unsolved',
    expectedDisposition: 'implemented',
    task: {prompt: 'Verify.', maxSeconds: 10},
    grade: {allowedWrites: [], checks: [{kind: 'exists', path: 'package.json'}]},
    trialChecks: {
      finalResponse: {required: ['passed'], forbidden: []},
      controlledEvents: [{probeId: 'verification', command: 'node -e "process.exit(0)"', outcomes: ['transient-failure', 'passed']}],
    },
  }, 'case.json', '/case');
  if (parsed.schemaVersion !== 3) assert.fail('expected version 3');
  return parsed;
}

function unavailableDefinition() {
  const parsed = parseCase({
    schemaVersion: 4,
    id: 'unavailable-control-case',
    level: 'focused',
    primaryModule: 'recovery',
    horizon: 'multi-stage',
    primaryQuality: 'recovery-resilience',
    supportingQualities: [],
    startState: 'unsolved',
    expectedDisposition: 'implemented',
    task: {prompt: 'Use the fallback.', maxSeconds: 10},
    grade: {allowedWrites: [], checks: [{kind: 'exists', path: 'package.json'}]},
    trialChecks: {
      finalResponse: {required: ['fallback'], forbidden: []},
      controlledEvents: [{
        probeId: 'native', strategy: 'unavailable', match: 'exact', outcomes: ['unavailable'],
      }],
    },
  }, 'case.json', '/case');
  if (parsed.schemaVersion !== 4) assert.fail('expected version 4');
  return parsed;
}

test('trial controls isolate state, fail once, pass later, and clean up', async () => {
  const first = await createTrialControl(definition(), process.cwd());
  const second = await createTrialControl(definition(), process.cwd());
  try {
    assert.notEqual(first.root, second.root);
    const helper = first.env.AGENT_EVAL_PROBE_VERIFICATION!;
    const run = () => runProcess({command: helper, args: [], cwd: process.cwd(), timeoutMs: 2_000});
    assert.equal((await run()).exitCode, 75);
    assert.equal((await run()).exitCode, 0);
    assert.deepEqual(first.readEvents().map((event) => event.outcome), ['transient-failure', 'passed']);
    assert.deepEqual(second.readEvents(), []);
  } finally {
    const firstRoot = first.root!;
    const secondRoot = second.root!;
    assert.equal(await first.cleanup(), true);
    assert.equal(await second.cleanup(), true);
    assert.equal(existsSync(firstRoot), false);
    assert.equal(existsSync(secondRoot), false);
  }
});

test('trial controls reject malformed and forged records', async () => {
  const control = await createTrialControl(definition(), process.cwd());
  try {
    const helper = control.env.AGENT_EVAL_PROBE_VERIFICATION!;
    assert.equal((await runProcess({command: helper, args: [], cwd: process.cwd(), timeoutMs: 2_000})).exitCode, 75);
    const log = `${control.root}/events.jsonl`;
    const first = readFileSync(log, 'utf8');
    writeFileSync(log, `${first}{"sequence":2,"probeId":"verification","outcome":"passed"}\n`);
    assert.throws(() => control.readEvents(), /does not match harness-owned events/);
    writeFileSync(log, 'not-json\n');
    assert.throws(() => control.readEvents(), /invalid control event JSONL/);
  } finally {
    assert.equal(await control.cleanup(), true);
  }
});

test('trial controls expose deterministic unavailable probes', async () => {
  const control = await createTrialControl(unavailableDefinition(), process.cwd());
  try {
    const helper = control.env.AGENT_EVAL_PROBE_NATIVE!;
    const first = await runProcess({command: helper, args: [], cwd: process.cwd(), timeoutMs: 2_000});
    const second = await runProcess({command: helper, args: [], cwd: process.cwd(), timeoutMs: 2_000});
    assert.equal(first.exitCode, 69);
    assert.match(first.stderr, /unavailable/);
    assert.equal(second.exitCode, 69);
    assert.deepEqual(control.readEvents().map((event) => event.outcome), ['unavailable', 'unavailable']);
  } finally {
    assert.equal(await control.cleanup(), true);
  }
});
