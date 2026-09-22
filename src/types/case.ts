export const LEGACY_CASE_SCHEMA_VERSION = 1 as const;
export const PREVIOUS_CASE_SCHEMA_VERSION = 2 as const;
export const MEASUREMENT_CASE_SCHEMA_VERSION = 3 as const;
export const MODULE_CASE_SCHEMA_VERSION = 4 as const;
export const CASE_SCHEMA_VERSION = 5 as const;

export const CASE_LEVELS = ['focused', 'workflow'] as const;
export type CaseLevel = (typeof CASE_LEVELS)[number];

export const CASE_MODULES = ['reasoning', 'execution', 'recovery', 'verification'] as const;
export type CaseModule = (typeof CASE_MODULES)[number];

export const CASE_TIERS = ['baseline', 'challenge'] as const;
export type CaseTier = (typeof CASE_TIERS)[number];

export const CASE_HORIZONS = ['short', 'multi-stage', 'long-horizon'] as const;
export type CaseHorizon = (typeof CASE_HORIZONS)[number];

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

export const EXPECTED_DISPOSITIONS = ['implemented', 'no-change', 'blocked'] as const;
export type ExpectedDisposition = (typeof EXPECTED_DISPOSITIONS)[number];

export const PROBE_OUTCOMES = ['transient-failure', 'unavailable', 'passed', 'failed'] as const;
export type ProbeOutcome = (typeof PROBE_OUTCOMES)[number];
export const PROBE_STRATEGIES = ['command', 'transient-first', 'unavailable'] as const;
export type ProbeStrategy = (typeof PROBE_STRATEGIES)[number];
export const PROBE_MATCHES = ['subsequence', 'exact'] as const;
export type ProbeMatch = (typeof PROBE_MATCHES)[number];
export type FinalResponseChecks = {required: string[]; forbidden: string[]};
export type ControlledEventCheck = {
  probeId: string;
  command: string | null;
  strategy: ProbeStrategy;
  match: ProbeMatch;
  outcomes: ProbeOutcome[];
};
export type TrialChecks = {
  finalResponse: FinalResponseChecks;
  controlledEvents: ControlledEventCheck[];
};
export type ControlledEvent = {
  sequence: number;
  probeId: string;
  outcome: ProbeOutcome;
};
export type TrialEvidenceFixture = {
  terminalStatus: 'completed' | 'denied' | 'timeout' | 'failed' | 'error';
  finalMessage: string | null;
  controlledEvents: ControlledEvent[];
};

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
  schemaVersion: typeof PREVIOUS_CASE_SCHEMA_VERSION;
  id: string;
  level: CaseLevel;
  primaryQuality: CaseQuality;
  supportingQualities: CaseQuality[];
  startState: StartState;
  task: TaskDefinition;
  grade: GradeDefinition<Check>;
  dir: string;
};

export type MeasurementCaseDefinition = {
  schemaVersion: typeof MEASUREMENT_CASE_SCHEMA_VERSION;
  id: string;
  level: CaseLevel;
  primaryQuality: CaseQuality;
  supportingQualities: CaseQuality[];
  startState: StartState;
  expectedDisposition: ExpectedDisposition;
  task: TaskDefinition;
  grade: GradeDefinition<Check>;
  trialChecks: TrialChecks;
  evidence: {knownGood: TrialEvidenceFixture; knownBad: TrialEvidenceFixture};
  dir: string;
};

export type ModuleCaseDefinition = {
  schemaVersion: typeof MODULE_CASE_SCHEMA_VERSION;
  id: string;
  level: CaseLevel;
  primaryModule: CaseModule;
  horizon: CaseHorizon;
  primaryQuality: CaseQuality;
  supportingQualities: CaseQuality[];
  startState: StartState;
  expectedDisposition: ExpectedDisposition;
  task: TaskDefinition;
  grade: GradeDefinition<Check>;
  trialChecks: TrialChecks;
  evidence: {knownGood: TrialEvidenceFixture; knownBad: TrialEvidenceFixture};
  dir: string;
};

export type TieredCaseDefinition = Omit<ModuleCaseDefinition, 'schemaVersion'> & {
  schemaVersion: typeof CASE_SCHEMA_VERSION;
  tier: CaseTier;
};

export type CaseDefinition =
  | LegacyCaseDefinition
  | VersionedCaseDefinition
  | MeasurementCaseDefinition
  | ModuleCaseDefinition
  | TieredCaseDefinition;

export type FileChanges = {added: string[]; modified: string[]; deleted: string[]};
export type CheckResult = {check: Check; ok: boolean; detail: string};
export type GradeResult = {
  solved: boolean;
  clean: boolean;
  checks: CheckResult[];
  changes: FileChanges;
  scopeViolations: string[];
};

export type FinalResponseCheckResult = {
  kind: 'required' | 'forbidden';
  pattern: string;
  ok: boolean;
  detail: string;
};
export type ControlledEventCheckResult = {
  probeId: string;
  expectedOutcomes: ProbeOutcome[];
  ok: boolean;
  detail: string;
};
export type BehaviorGrade = {
  expectedDisposition: ExpectedDisposition | null;
  dispositionPassed: boolean;
  finalResponse: {passed: boolean; checks: FinalResponseCheckResult[]};
  controlledEvents: {
    passed: boolean;
    checks: ControlledEventCheckResult[];
    events: ControlledEvent[];
  };
  passed: boolean;
};
