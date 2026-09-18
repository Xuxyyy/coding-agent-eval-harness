import type {CaseDefinition} from './case.js';
import type {ProfileIdentity} from './report.js';

export const SUITE_SCHEMA_VERSION = 1 as const;

export type SuiteProfile = {id: string; caseIds: string[]; repeats: number};
export type SuiteDefinition = {
  schemaVersion: typeof SUITE_SCHEMA_VERSION;
  id: string;
  profiles: SuiteProfile[];
  dir: string;
};

export type SelectedCases = {
  cases: CaseDefinition[];
  repeats: number;
  profile: ProfileIdentity | null;
};
