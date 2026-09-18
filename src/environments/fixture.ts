import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import type {CaseDefinition, FileChanges} from '../types/index.js';
import {safeRelativePath} from '../suites/cases.js';

export const FIXTURE_PREFIX = 'agent-eval-fixture-';
export const DELETE_MANIFEST = '.delete';
export const EMPTY_OVERLAY_MARKER = '.empty-overlay';

function copyTree(source: string, destination: string, skipDelete = false): void {
  mkdirSync(destination, {recursive: true});
  for (const entry of readdirSync(source, {withFileTypes: true})) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isSymbolicLink() || lstatSync(from).isSymbolicLink()) {
      throw new Error(`symlinks are not allowed: ${from}`);
    }
    if (skipDelete && (entry.name === DELETE_MANIFEST || entry.name === EMPTY_OVERLAY_MARKER)) continue;
    if (entry.isDirectory()) copyTree(from, to, false);
    else if (entry.isFile()) copyFileSync(from, to);
    else throw new Error(`unsupported fixture entry: ${from}`);
  }
}

function git(root: string, args: string[]): void {
  const run = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  if (run.error || run.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${run.error?.message ?? run.stderr}`);
  }
}

export function initializeGit(root: string): void {
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.name', 'Agent Eval Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['add', '--all']);
  git(root, ['commit', '-q', '-m', 'fixture: initial state']);
}

export function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function walk(root: string, relative: string, into: Map<string, string>): void {
  const current = relative === '' ? root : join(root, relative);
  for (const entry of readdirSync(current, {withFileTypes: true})) {
    if (relative === '' && entry.name === '.git') continue;
    const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
    const target = join(root, path);
    if (entry.isSymbolicLink() || lstatSync(target).isSymbolicLink()) {
      throw new Error(`workspace symlink is not supported: ${path}`);
    }
    if (entry.isDirectory()) walk(root, path, into);
    else if (entry.isFile()) into.set(path, hashFile(target));
  }
}

export function snapshot(root: string): Map<string, string> {
  const result = new Map<string, string>();
  if (existsSync(root)) walk(resolve(root), '', result);
  return new Map([...result].sort(([a], [b]) => a.localeCompare(b)));
}

export function compareSnapshots(
  before: Map<string, string>,
  after: Map<string, string>,
): FileChanges {
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  for (const [path, hash] of after) {
    if (!before.has(path)) added.push(path);
    else if (before.get(path) !== hash) modified.push(path);
  }
  for (const path of before.keys()) if (!after.has(path)) deleted.push(path);
  return {added: added.sort(), modified: modified.sort(), deleted: deleted.sort()};
}

export function createFixture(definition: CaseDefinition): {
  root: string;
  before: Map<string, string>;
} {
  const root = mkdtempSync(join(tmpdir(), FIXTURE_PREFIX));
  try {
    copyTree(join(definition.dir, 'workspace'), root);
    initializeGit(root);
    return {root, before: snapshot(root)};
  } catch (error) {
    removeFixture(root);
    throw error;
  }
}

export function applyOverlay(
  definition: CaseDefinition,
  root: string,
  overlay: 'solution' | 'counterexample',
): void {
  const source = join(definition.dir, overlay);
  const manifest = join(source, DELETE_MANIFEST);
  copyTree(source, root, true);
  if (!existsSync(manifest)) return;
  for (const raw of readFileSync(manifest, 'utf8').split(/\r?\n/)) {
    const value = raw.trim();
    if (value === '') continue;
    const path = safeRelativePath(`${manifest} entry`, value);
    const target = join(root, path);
    if (!resolve(target).startsWith(`${resolve(root)}/`)) {
      throw new Error(`delete path escapes workspace: ${path}`);
    }
    if (existsSync(target)) {
      if (lstatSync(target).isDirectory()) rmSync(target, {recursive: true, force: true});
      else unlinkSync(target);
    }
  }
}

export function writeFixtureFile(root: string, path: string, content: string): void {
  const safe = safeRelativePath('fixture path', path);
  const target = join(root, safe);
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, content);
}

export function removeFixture(root: string): boolean {
  try {
    rmSync(root, {recursive: true, force: true});
    return !existsSync(root);
  } catch {
    return false;
  }
}
