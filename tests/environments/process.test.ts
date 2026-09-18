import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {runProcess} from '../../src/environments/process.js';

test('runProcess passes argv/cwd/env, captures streams, and bounds output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-process-'));
  try {
    const script = join(root, 'probe.mjs');
    writeFileSync(
      script,
      "console.log(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),value:process.env.PROBE})); process.stdout.write('x'.repeat(1000)); process.stderr.write('stderr');",
    );
    const result = await runProcess({
      command: process.execPath,
      args: [script, 'a', 'two words'],
      cwd: root,
      env: {PROBE: 'yes'},
      timeoutMs: 2_000,
      outputLimitBytes: 250,
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.cleanupComplete, true);
    assert.equal(result.truncated.stdout, true);
    assert.equal(result.truncated.stderr, false);
    const first = JSON.parse(result.stdout.split('\n')[0]!);
    assert.deepEqual(first.argv, ['a', 'two words']);
    assert.equal(first.cwd, realpathSync(root));
    assert.equal(first.value, 'yes');
    assert.equal(result.stderr, 'stderr');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runProcess records missing executables and nonzero exits', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-process-'));
  try {
    const missing = await runProcess({
      command: join(root, 'missing'),
      args: [],
      cwd: root,
      timeoutMs: 1_000,
    });
    assert.match(missing.error ?? '', /ENOENT/);
    const failed = await runProcess({
      command: process.execPath,
      args: ['-e', "process.stderr.write('bad'); process.exit(7)"],
      cwd: root,
      timeoutMs: 1_000,
    });
    assert.equal(failed.exitCode, 7);
    assert.equal(failed.stderr, 'bad');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runProcess escalates timeout termination to SIGKILL', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-process-'));
  try {
    const result = await runProcess({
      command: process.execPath,
      args: ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"],
      cwd: root,
      timeoutMs: 80,
      killGraceMs: 60,
    });
    assert.equal(result.timedOut, true);
    assert.equal(result.signal, 'SIGKILL');
    assert.equal(result.cleanupComplete, true);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('runProcess removes surviving children from the process group', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-eval-process-'));
  const marker = join(root, 'leaked.txt');
  try {
    const childCode = `setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'leaked'),500)`;
    const parentCode = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'ignore'}); setTimeout(()=>process.exit(0),100);`;
    const result = await runProcess({
      command: process.execPath,
      args: ['-e', parentCode],
      cwd: root,
      timeoutMs: 2_000,
      killGraceMs: 80,
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.cleanupComplete, true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
