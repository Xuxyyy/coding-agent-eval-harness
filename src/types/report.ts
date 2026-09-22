import {TRIAL_ARTIFACT_SCHEMA_VERSION} from './artifact.js';
import type {CaseModule, CaseQuality, CaseTier} from './case.js';

export const LEGACY_REPORT_SCHEMA_VERSION = 2 as const;
export const STRUCTURED_REPORT_SCHEMA_VERSION = 3 as const;
export const MEASUREMENT_REPORT_SCHEMA_VERSION = 4 as const;
export const MODULE_REPORT_SCHEMA_VERSION = 5 as const;
export const REPORT_SCHEMA_VERSION = 6 as const;

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
export type ModuleAggregate = {
  module: CaseModule;
  total: number;
  scored: number;
  errors: number;
  passes: Rate;
};
export type TierAggregate = {
  tier: CaseTier;
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
  repositoryPassed: Rate;
  behaviorPassed: Rate;
  byCase: CaseAggregate[];
  byTier: TierAggregate[];
  byPrimaryModule: ModuleAggregate[];
  byPrimaryQuality: QualityAggregate[];
};

export type SelectionIdentity = {
  suiteId: string | null;
  tier: CaseTier | null;
  module: CaseModule | null;
  caseIds: string[];
  repeats: number;
};
export type SelectionVerdict = 'met' | 'not_met' | 'incomplete';

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
  selection: SelectionIdentity;
  selectionVerdict: SelectionVerdict;
  maxSecondsCap: number | null;
  suiteContentHash: string;
  artifactSchemaVersion: typeof TRIAL_ARTIFACT_SCHEMA_VERSION;
  artifactRoot: string;
  caseSchemaVersions: Record<string, number>;
  terminalStatus: 'completed' | 'failed' | 'error';
  aggregate: Aggregate;
  cleanup: {workspaces: boolean; adapterHomes: boolean; processes: boolean; controls: boolean};
};
