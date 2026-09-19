import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import type {ProcessResult} from '../../src/environments/process.js';
import {accAdapter, accArguments, parseAcc} from '../../src/adapters/acc.js';
import {claudeAdapter, claudeArguments, parseClaude} from '../../src/adapters/claude.js';
import {codexAdapter, codexArguments, parseCodex} from '../../src/adapters/codex.js';
import {adapterById} from '../../src/adapters/registry.js';

function processResult(
  stdout: string,
  options: Partial<ProcessResult> = {},
): ProcessResult {
  const stdoutBytes = Buffer.from(stdout);
  return {
    exitCode: 0,
    signal: null,
    stdout,
    stderr: '',
    stdoutBytes,
    stderrBytes: Buffer.alloc(0),
    truncated: {stdout: false, stderr: false},
    timedOut: false,
    elapsedMs: 10,
    cleanupComplete: true,
    ...options,
  };
}

function sample(name: string): string {
  return readFileSync(resolve('tests/fixtures/adapters', name), 'utf8');
}

test('ACC parser extracts completion, final text, and labeled usage', () => {
  const result = parseAcc(processResult(sample('acc-completed.jsonl')), true);
  assert.equal(result.terminalStatus, 'completed');
  assert.equal(result.finalMessage, 'Done safely.');
  assert.deepEqual(result.usage, {
    inputTokens: 40,
    outputTokens: 7,
    totalTokens: 47,
    prompts: 0,
    steps: 2,
  });
  assert.deepEqual(result.events.map((event) => event.kind), [
    'other', 'tool_call', 'tool_result', 'assistant_message', 'assistant_message', 'usage', 'terminal',
  ]);
  assert.equal(result.events.some((event) => event.providerEventType === 'reasoning_delta'), false);
});

test('ACC parser classifies denial, timeout, and agent error', () => {
  const denied = parseAcc(
    processResult('{"kind":"result","stopped":"denied","usage":{},"prompts":1,"steps":0}\n', {exitCode: 1}),
    true,
  );
  assert.equal(denied.terminalStatus, 'denied');
  const timeout = parseAcc(
    processResult('{"kind":"result","stopped":"timeout","usage":{},"prompts":0,"steps":1}\n', {exitCode: 1}),
    true,
  );
  assert.equal(timeout.terminalStatus, 'timeout');
  const failed = parseAcc(
    processResult('{"kind":"result","stopped":"error","error":"provider unavailable","usage":{}}\n', {exitCode: 1}),
    true,
  );
  assert.equal(failed.terminalStatus, 'error');
  assert.equal(failed.error, 'provider unavailable');
});

test('ACC parser rejects malformed, incomplete, truncated, and mismatched streams', () => {
  assert.match(parseAcc(processResult('not json\n'), true).error ?? '', /malformed JSONL/);
  assert.match(parseAcc(processResult('{"type":"text_delta","text":"x"}\n'), true).error ?? '', /no authoritative/);
  assert.match(
    parseAcc(processResult('{"kind":"result","stopped":"done"}\n', {exitCode: 2}), true).error ?? '',
    /reported done but exited 2/,
  );
  assert.match(
    parseAcc(
      processResult('', {truncated: {stdout: true, stderr: false}}),
      true,
    ).error ?? '',
    /capture limit/,
  );
  assert.match(
    parseAcc(
      processResult('{"kind":"result","schemaVersion":2,"stopped":"done"}\n'),
      true,
    ).error ?? '',
    /unsupported ACC result schema version: 2/,
  );
});

test('ACC parser prefers the authoritative result message over streamed deltas', () => {
  const result = parseAcc(
    processResult(
      '{"type":"text_delta","text":"partial"}\n' +
        '{"kind":"result","schemaVersion":1,"stopped":"done","message":"final","usage":{}}\n',
    ),
    true,
  );

  assert.equal(result.finalMessage, 'final');
});

test('Codex parser tolerates unknown and item-level errors before completion', () => {
  const result = parseCodex(processResult(sample('codex-completed.jsonl')));
  assert.equal(result.terminalStatus, 'completed');
  assert.equal(result.finalMessage, 'Finished safely.');
  assert.deepEqual(result.usage, {
    inputTokens: 50,
    cachedInputTokens: 10,
    outputTokens: 8,
    totalTokens: 58,
  });
  assert.equal(result.publicSessionId, 'sanitized');
  assert.deepEqual(result.events.map((event) => event.kind), [
    'other', 'other', 'other', 'tool_call', 'tool_result', 'assistant_message', 'usage', 'terminal',
  ]);
  assert.equal(result.events.some((event) => event.providerEventType.includes('reasoning')), false);
});

test('Codex parser classifies turn.failed and top-level error', () => {
  const failed = parseCodex(
    processResult('{"type":"turn.failed","error":{"message":"model stopped"}}\n', {exitCode: 1}),
  );
  assert.equal(failed.terminalStatus, 'failed');
  assert.equal(failed.error, 'model stopped');
  const error = parseCodex(
    processResult('{"type":"error","message":"authentication required"}\n', {exitCode: 1}),
  );
  assert.equal(error.terminalStatus, 'error');
  assert.equal(error.error, 'authentication required');
});

test('Codex parser rejects malformed, incomplete, and exit-mismatched streams', () => {
  assert.match(parseCodex(processResult('{\n')).error ?? '', /malformed JSONL/);
  assert.match(parseCodex(processResult('{"type":"thread.started"}\n')).error ?? '', /no authoritative/);
  assert.match(
    parseCodex(processResult('{"type":"turn.completed","usage":{}}\n', {exitCode: 1})).error ?? '',
    /reported completion but exited 1/,
  );
});

test('Claude parser extracts completion, tool events, final text, and usage', () => {
  const result = parseClaude(processResult(sample('claude-completed.jsonl')));
  assert.equal(result.terminalStatus, 'completed');
  assert.equal(result.finalMessage, 'Finished safely.');
  assert.deepEqual(result.usage, {
    inputTokens: 60,
    cachedInputTokens: 12,
    outputTokens: 9,
    totalTokens: 69,
  });
  assert.equal(result.publicSessionId, 'sanitized-claude');
  assert.deepEqual(result.events.map((event) => event.kind), [
    'other', 'tool_call', 'tool_result', 'assistant_message', 'usage', 'terminal',
  ]);
  assert.equal(result.events.some((event) => event.providerEventType.includes('thinking')), false);
  assert.deepEqual(result.events[2], {
    sequence: 3,
    kind: 'tool_result',
    providerEventType: 'user',
    toolName: 'Edit',
    toolCallId: 'tool-1',
    status: 'completed',
  });
});

test('Claude parser classifies terminal failures and rejects unusable streams', () => {
  const failed = parseClaude(processResult(
    '{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["provider unavailable"],"session_id":"session","usage":{}}\n',
    {exitCode: 1},
  ));
  assert.equal(failed.terminalStatus, 'failed');
  assert.equal(failed.error, 'provider unavailable');
  assert.match(parseClaude(processResult('{\n')).error ?? '', /malformed JSONL/);
  assert.match(
    parseClaude(processResult('{"type":"system","subtype":"init"}\n')).error ?? '',
    /no authoritative/,
  );
  assert.match(
    parseClaude(processResult(
      '{"type":"result","subtype":"success","is_error":false,"result":"done","usage":{}}\n',
      {exitCode: 2},
    )).error ?? '',
    /reported success but exited 2/,
  );
});

test('adapter argument builders preserve exact public CLI boundaries', () => {
  const invocation = {
    command: '/bin/agent',
    cwd: '/tmp/fixture',
    prompt: 'Fix the tests.',
    maxSeconds: 12,
    model: 'requested-model',
  };
  assert.deepEqual(accArguments(invocation), [
    '-p',
    'Fix the tests.',
    '--json',
    '--yes',
    '--max-seconds',
    '12',
  ]);
  assert.deepEqual(codexArguments(invocation), [
    '--ask-for-approval',
    'never',
    '--sandbox',
    'workspace-write',
    '--cd',
    '/tmp/fixture',
    '--model',
    'requested-model',
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--json',
    'Fix the tests.',
  ]);
  assert.deepEqual(claudeArguments(invocation), [
    '-p',
    'Fix the tests.',
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--no-session-persistence',
    '--safe-mode',
    '--model',
    'requested-model',
  ]);
});

function fakeExecutable(root: string): string {
  const executable = join(root, 'fake-agent');
  writeFileSync(
    executable,
    `#!/usr/bin/env node
import {readFileSync} from 'node:fs';
if (process.argv.includes('--version')) { console.log('fake-agent 1.2.3'); process.exit(0); }
const isCodex = process.argv.includes('exec');
const isClaude = process.argv.includes('stream-json');
const home = process.env.ACC_HOME;
const settings = home ? JSON.parse(readFileSync(home + '/settings.json','utf8')) : null;
console.log(JSON.stringify({type:'probe',argv:process.argv.slice(2),cwd:process.cwd(),accHome:home ?? null,settings,codexHome:process.env.CODEX_HOME ?? null,claudeConfigDir:process.env.CLAUDE_CONFIG_DIR ?? null,trialProbe:process.env.AGENT_EVAL_PROBE_VERIFICATION ?? null}));
if (isCodex) {
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:2}}));
} else if (isClaude) {
  console.log(JSON.stringify({type:'assistant',session_id:'fake-session',message:{content:[{type:'text',text:'ok'}]}}));
  console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'ok',session_id:'fake-session',usage:{input_tokens:1,output_tokens:2}}));
} else {
  console.log(JSON.stringify({type:'text_delta',text:'ok'}));
  console.log(JSON.stringify({kind:'result',stopped:'done',usage:{prompt:1,completion:2,total:3},prompts:0,steps:0}));
}
`,
  );
  chmodSync(executable, 0o755);
  return executable;
}

test('ACC adapter uses isolated settings and deletes its owned home', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-adapter-'));
  try {
    const executable = fakeExecutable(root);
    const result = await accAdapter.run({
      command: executable,
      cwd: root,
      prompt: 'task',
      maxSeconds: 2,
      model: 'chosen-model',
      env: {ACC_HOME: 'must-not-win', AGENT_EVAL_PROBE_VERIFICATION: '/tmp/probe'},
    });
    assert.equal(result.terminalStatus, 'completed');
    const probe = JSON.parse(result.stdout.split('\n')[0]!);
    assert.deepEqual(probe.argv, ['-p', 'task', '--json', '--yes', '--max-seconds', '2']);
    assert.deepEqual(probe.settings, {permission_mode: 'auto-edits', model: 'chosen-model'});
    assert.equal(probe.cwd.endsWith(root.split('/').at(-1)!), true);
    assert.equal(existsSync(probe.accHome), false);
    assert.notEqual(probe.accHome, 'must-not-win');
    assert.equal(probe.trialProbe, '/tmp/probe');
    assert.deepEqual(result.cleanup, {adapterHome: true, process: true});
    assert.equal(await accAdapter.version(executable, root), 'fake-agent 1.2.3');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('Codex adapter preserves CODEX_HOME and runs ephemerally', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-adapter-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = 'sentinel-auth-home';
  try {
    const executable = fakeExecutable(root);
    const result = await codexAdapter.run({
      command: executable,
      cwd: root,
      prompt: 'task',
      maxSeconds: 2,
      env: {CODEX_HOME: 'must-not-win', AGENT_EVAL_PROBE_VERIFICATION: '/tmp/probe'},
    });
    assert.equal(result.terminalStatus, 'completed');
    const probe = JSON.parse(result.stdout.split('\n')[0]!);
    assert.equal(probe.codexHome, 'sentinel-auth-home');
    assert.equal(probe.trialProbe, '/tmp/probe');
    assert.deepEqual(probe.argv, codexArguments({command: executable, cwd: root, prompt: 'task', maxSeconds: 2}));
    assert.equal(await codexAdapter.version(executable, root), 'fake-agent 1.2.3');
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
    rmSync(root, {recursive: true, force: true});
  }
});

test('Claude adapter preserves authentication environment and runs without persistence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-adapter-'));
  const previous = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = 'sentinel-auth-home';
  try {
    const executable = fakeExecutable(root);
    const result = await claudeAdapter.run({
      command: executable,
      cwd: root,
      prompt: 'task',
      maxSeconds: 2,
      env: {CLAUDE_CONFIG_DIR: 'must-not-win', AGENT_EVAL_PROBE_VERIFICATION: '/tmp/probe'},
    });
    assert.equal(result.terminalStatus, 'completed');
    const probe = JSON.parse(result.stdout.split('\n')[0]!);
    assert.equal(probe.claudeConfigDir, 'sentinel-auth-home');
    assert.equal(probe.trialProbe, '/tmp/probe');
    assert.deepEqual(
      probe.argv,
      claudeArguments({command: executable, cwd: root, prompt: 'task', maxSeconds: 2}),
    );
    assert.equal(await claudeAdapter.version(executable, root), 'fake-agent 1.2.3');
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previous;
    rmSync(root, {recursive: true, force: true});
  }
});

test('adapters report missing executables and Codex process timeouts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-adapter-'));
  try {
    const missing = await accAdapter.run({
      command: join(root, 'missing'),
      cwd: root,
      prompt: 'task',
      maxSeconds: 1,
    });
    assert.equal(missing.terminalStatus, 'error');
    assert.match(missing.error ?? '', /launch failed/);

    const hanging = join(root, 'hanging-agent');
    writeFileSync(hanging, "#!/usr/bin/env node\nprocess.on('SIGTERM',()=>{}); setInterval(()=>{},1000);\n");
    chmodSync(hanging, 0o755);
    const timeout = await codexAdapter.run({
      command: hanging,
      cwd: root,
      prompt: 'task',
      maxSeconds: 0.05,
    });
    assert.equal(timeout.terminalStatus, 'timeout');
    assert.equal(timeout.cleanup.process, true);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('adapter selection rejects unknown names', () => {
  assert.equal(adapterById('acc').id, 'acc');
  assert.equal(adapterById('codex').id, 'codex');
  assert.equal(adapterById('claude').id, 'claude');
  assert.throws(() => adapterById('other'), /use acc, codex, or claude/);
});
