import type {CaseDefinition, CaseModule} from './case.js';
import type {ProfileIdentity} from './report.js';

export const LEGACY_SUITE_SCHEMA_VERSION = 1 as const;
export const SUITE_SCHEMA_VERSION = 2 as const;

export type SuiteProfile = {
  id: string;
  module: CaseModule | 'all' | null;
  caseIds: string[];
  repeats: number;
};
export type SuiteDefinition = {
  schemaVersion: typeof LEGACY_SUITE_SCHEMA_VERSION | typeof SUITE_SCHEMA_VERSION;
  id: string;
  profiles: SuiteProfile[];
  dir: string;
};

export type SelectedCases = {
  cases: CaseDefinition[];
  repeats: number;
  profile: ProfileIdentity | null;
};
