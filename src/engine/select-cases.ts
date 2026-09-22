import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadCases, loadSuite} from '../suites/cases.js';
import {
  CASE_SCHEMA_VERSION,
  SUITE_SCHEMA_VERSION,
  type CaseModule,
  type CaseTier,
  type SelectedCases,
} from '../types/index.js';

export type SelectionOptions = {
  casesDir: string;
  caseIds?: string[];
  repeats?: number;
  tier?: CaseTier;
  module?: CaseModule;
};

export function selectCases(options: SelectionOptions): SelectedCases {
  const loaded = loadCases(options.casesDir);
  const manifest = join(options.casesDir, 'suite.json');
  const suite = existsSync(manifest) ? loadSuite(options.casesDir, loaded) : null;
  const byId = new Map(loaded.map((item) => [item.id, item]));
  const all = suite?.schemaVersion === SUITE_SCHEMA_VERSION
    ? suite.caseOrder.map((id) => byId.get(id)!)
    : loaded;

  if (options.caseIds !== undefined && (options.tier !== undefined || options.module !== undefined)) {
    throw new Error('case selection cannot be combined with tier or module filters');
  }

  const repeats = options.repeats ?? 1;
  if (!Number.isInteger(repeats) || repeats <= 0) {
    throw new Error('repeats must be a positive integer');
  }
  let selected = all;
  if (options.caseIds !== undefined && options.caseIds.length > 0) {
    const requested = new Set(options.caseIds);
    selected = all.filter((item) => requested.has(item.id));
    const missing = [...requested].filter((id) => !selected.some((item) => item.id === id));
    if (missing.length > 0) throw new Error(`unknown case id(s): ${missing.join(', ')}`);
  } else if (options.tier !== undefined || options.module !== undefined) {
    if (all.some((definition) => definition.schemaVersion !== CASE_SCHEMA_VERSION)) {
      throw new Error(`tier and module filters require version ${CASE_SCHEMA_VERSION} cases`);
    }
    selected = all.filter((definition) =>
      definition.schemaVersion === CASE_SCHEMA_VERSION &&
      (options.tier === undefined || definition.tier === options.tier) &&
      (options.module === undefined || definition.primaryModule === options.module));
    if (selected.length === 0) throw new Error('no cases match the selected tier and module filters');
  }

  return {
    cases: selected,
    repeats,
    selection: {
      suiteId: suite?.id ?? null,
      tier: options.tier ?? null,
      module: options.module ?? null,
      caseIds: selected.map((item) => item.id),
      repeats,
    },
  };
}
