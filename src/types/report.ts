import {TRIAL_ARTIFACT_SCHEMA_VERSION} from './artifact.js';
import type {CaseQuality} from './case.js';

export const LEGACY_REPORT_SCHEMA_VERSION = 2 as const;
export const REPORT_SCHEMA_VERSION = 3 as const;

export type Rate = {count: number; of: number; rate: number | null};
export type CaseAggregate = {
  id: string;
  total: number;
  required: number | null;
  complete: boolean | null;
  scored: number;
  errors: number;
  passes: number;
};
export type QualityAggregate = {
  quality: CaseQuality;
  total: number;
  scored: number;
  errors: number;
  passes: Rate;
};
export type Aggregate = {
  total: number;
  scored: number;
  errors: number;
  passes: Rate;
  solved: Rate;
  clean: Rate;
  byCase: CaseAggregate[];
  byPrimaryQuality: QualityAggregate[];
};

export type ProfileIdentity = {
  suiteId: string;
  profileId: string;
  caseIds: string[];
  repeats: number;
};
export type ProfileVerdict = 'met' | 'not_met' | 'incomplete';

export type RunReport = {
  kind: 'report';
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  requestedAdapter: string;
  requestedModel: string | null;
  agentExecutableVersion: string;
  startedAt: string;
  elapsedMs: number;
  node: string;
  platform: string;
  repeats: number;
  selectedCaseIds: string[];
  profile: ProfileIdentity | null;
  profileVerdict: ProfileVerdict | null;
  maxSecondsCap: number | null;
  suiteContentHash: string;
  artifactSchemaVersion: typeof TRIAL_ARTIFACT_SCHEMA_VERSION;
  artifactRoot: string;
  caseSchemaVersions: Record<string, number>;
  terminalStatus: 'completed' | 'failed' | 'error';
  aggregate: Aggregate;
  cleanup: {workspaces: boolean; adapterHomes: boolean; processes: boolean};
};
