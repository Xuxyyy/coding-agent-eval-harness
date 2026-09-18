import {existsSync, readFileSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {compareSnapshots, hashFile, snapshot} from '../environments/fixture.js';
import type {
  CaseDefinition,
  Check,
  CheckResult,
  GradeResult,
} from '../types/index.js';

export const CHECK_TIMEOUT_MS = 60_000;
export const CHECK_OUTPUT_LIMIT = 8_192;

export function truncate(value: string, limit = CHECK_OUTPUT_LIMIT): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}… [truncated ${value.length - limit} chars]`;
}

function runCheck(
  check: Check,
  root: string,
  before: Map<string, string>,
): CheckResult {
  if (check.kind === 'exists') {
    const ok = existsSync(join(root, check.path));
    return {check, ok, detail: ok ? `${check.path} exists` : `${check.path} is missing`};
  }
  if (check.kind === 'unchanged') {
    const target = join(root, check.path);
    const was = before.get(check.path);
    const ok =
      was !== undefined &&
      existsSync(target) &&
      statSync(target).isFile() &&
      hashFile(target) === was;
    return {
      check,
      ok,
      detail: ok ? `${check.path} is byte-identical` : `${check.path} changed or is missing`,
    };
  }
  if (check.kind === 'absent') {
    const ok = !existsSync(join(root, check.path));
    return {check, ok, detail: ok ? `${check.path} is absent` : `${check.path} exists`};
  }
  if (check.kind === 'contains' || check.kind === 'matches') {
    const target = join(root, check.path);
    if (!existsSync(target)) {
      return {check, ok: false, detail: `${check.path} is missing`};
    }
    if (!statSync(target).isFile()) {
      return {check, ok: false, detail: `${check.path} is not a regular file`};
    }
    const content = readFileSync(target, 'utf8');
    const ok = check.kind === 'contains'
      ? content.includes(check.text)
      : new RegExp(check.pattern).test(content);
    const expectation = check.kind === 'contains'
      ? `exact text ${JSON.stringify(truncate(check.text, 160))}`
      : `pattern ${JSON.stringify(truncate(check.pattern, 160))}`;
    return {
      check,
      ok,
      detail: ok
        ? `${check.path} contains ${expectation}`
        : `${check.path} does not contain ${expectation}`,
    };
  }
  const {NODE_TEST_CONTEXT: _nodeTestContext, ...environment} = process.env;
  const child = spawnSync(check.command, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
    maxBuffer: CHECK_OUTPUT_LIMIT * 8,
    env: environment,
  });
  const output = truncate(`${child.stdout ?? ''}${child.stderr ?? ''}`.trim());
  const ok = child.status === 0 && child.error === undefined;
  return {
    check,
    ok,
    detail: ok
      ? `${check.command} exited 0${output === '' ? '' : `\n${output}`}`
      : `${check.command} ${child.error ? `failed: ${child.error.message}` : `exited ${child.status ?? 'on a signal'}`}${output === '' ? '' : `\n${output}`}`,
  };
}

export function pathsOutsideAllowed(
  changes: {added: string[]; modified: string[]; deleted: string[]},
  allowedWrites: readonly string[],
): string[] {
  return [...changes.added, ...changes.modified, ...changes.deleted]
    .filter((path) => !allowedWrites.includes(path))
    .sort();
}

export function gradeCase(
  definition: CaseDefinition,
  root: string,
  before: Map<string, string>,
): GradeResult {
  const checks = definition.grade.checks.map((check) => runCheck(check, root, before));
  const changes = compareSnapshots(before, snapshot(root));
  const scopeViolations = pathsOutsideAllowed(changes, definition.grade.allowedWrites);
  return {
    solved: checks.every((result) => result.ok),
    clean: scopeViolations.length === 0,
    checks,
    changes,
    scopeViolations,
  };
}
