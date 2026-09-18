export const LEGACY_CASE_SCHEMA_VERSION = 1 as const;
export const CASE_SCHEMA_VERSION = 2 as const;

export const CASE_LEVELS = ['focused', 'workflow'] as const;
export type CaseLevel = (typeof CASE_LEVELS)[number];

export const CASE_QUALITIES = [
  'task-effectiveness',
  'repository-understanding',
  'change-discipline',
  'user-work-protection',
  'instruction-adherence',
  'verification-quality',
  'judgment-autonomy',
  'recovery-resilience',
  'communication-handoff',
] as const;
export type CaseQuality = (typeof CASE_QUALITIES)[number];

export const START_STATES = ['unsolved', 'satisfied'] as const;
export type StartState = (typeof START_STATES)[number];

export type ExistsCheck = {kind: 'exists'; path: string};
export type Exit0Check = {kind: 'exit0'; command: string};
export type UnchangedCheck = {kind: 'unchanged'; path: string};
export type AbsentCheck = {kind: 'absent'; path: string};
export type ContainsCheck = {kind: 'contains'; path: string; text: string};
export type MatchesCheck = {kind: 'matches'; path: string; pattern: string};
export type LegacyCheck = ExistsCheck | Exit0Check | UnchangedCheck;
export type Check = LegacyCheck | AbsentCheck | ContainsCheck | MatchesCheck;

type TaskDefinition = {prompt: string; maxSeconds: number};
type GradeDefinition<TCheck extends Check> = {allowedWrites: string[]; checks: TCheck[]};

export type LegacyCaseDefinition = {
  schemaVersion: typeof LEGACY_CASE_SCHEMA_VERSION;
  id: string;
  category: string;
  task: TaskDefinition;
  grade: GradeDefinition<LegacyCheck>;
  dir: string;
};

export type VersionedCaseDefinition = {
  schemaVersion: typeof CASE_SCHEMA_VERSION;
  id: string;
  level: CaseLevel;
  primaryQuality: CaseQuality;
  supportingQualities: CaseQuality[];
  startState: StartState;
  task: TaskDefinition;
  grade: GradeDefinition<Check>;
  dir: string;
};

export type CaseDefinition = LegacyCaseDefinition | VersionedCaseDefinition;

export type FileChanges = {added: string[]; modified: string[]; deleted: string[]};
export type CheckResult = {check: Check; ok: boolean; detail: string};
export type GradeResult = {
  solved: boolean;
  clean: boolean;
  checks: CheckResult[];
  changes: FileChanges;
  scopeViolations: string[];
};
