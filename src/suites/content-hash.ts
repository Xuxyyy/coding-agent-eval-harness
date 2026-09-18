import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import type {CaseDefinition} from '../types/index.js';

function filesUnder(root: string, prefix = ''): string[] {
  const found: string[] = [];
  const current = prefix === '' ? root : join(root, prefix);
  for (const entry of readdirSync(current, {withFileTypes: true})) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...filesUnder(root, path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}

export function suiteContentHash(cases: readonly CaseDefinition[]): string {
  const hash = createHash('sha256');
  for (const definition of [...cases].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const path of filesUnder(definition.dir)) {
      hash.update(definition.id);
      hash.update('\0');
      hash.update(path);
      hash.update('\0');
      hash.update(readFileSync(join(definition.dir, path)));
      hash.update('\0');
    }
  }
  return hash.digest('hex');
}
