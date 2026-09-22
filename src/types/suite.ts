import type {CaseDefinition, CaseModule, CaseTier} from './case.js';
import type {SelectionIdentity} from './report.js';

export const LEGACY_SUITE_SCHEMA_VERSION = 1 as const;
export const MODULE_SUITE_SCHEMA_VERSION = 2 as const;
export const SUITE_SCHEMA_VERSION = 3 as const;

export type SuiteProfile = {
  id: string;
  module: CaseModule | 'all' | null;
  caseIds: string[];
  repeats: number;
};
export type ProfileSuiteDefinition = {
  schemaVersion: typeof LEGACY_SUITE_SCHEMA_VERSION | typeof MODULE_SUITE_SCHEMA_VERSION;
  id: string;
  profiles: SuiteProfile[];
  dir: string;
};
export type OrderedSuiteDefinition = {
  schemaVersion: typeof SUITE_SCHEMA_VERSION;
  id: string;
  caseOrder: string[];
  dir: string;
};
export type SuiteDefinition = ProfileSuiteDefinition | OrderedSuiteDefinition;

export type SelectedCases = {
  cases: CaseDefinition[];
  repeats: number;
  selection: SelectionIdentity;
};

export type SelectionFilters = {tier?: CaseTier; module?: CaseModule};
