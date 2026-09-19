import type {AdapterTerminalStatus, Usage} from './adapter.js';
import type {
  BehaviorGrade,
  CaseLevel,
  CaseQuality,
  CheckResult,
  ExpectedDisposition,
  FileChanges,
  GradeResult,
  StartState,
} from './case.js';

export type TrialStatus = 'pass' | 'fail' | 'error';
export type TrialRecord = {
  kind: 'trial';
  caseId: string;
  repeat: number;
  adapter: string;
  requestedModel: string | null;
  level: CaseLevel | null;
  primaryQuality: CaseQuality | null;
  supportingQualities: CaseQuality[];
  startState: StartState | null;
  expectedDisposition: ExpectedDisposition | null;
  terminalStatus: AdapterTerminalStatus;
  status: TrialStatus;
  solved: boolean;
  clean: boolean;
  repositoryPassed: boolean;
  behaviorPassed: boolean;
  repositoryGrade: GradeResult;
  behaviorGrade: BehaviorGrade;
  elapsedMs: number;
  usage: Usage | null;
  checks: CheckResult[];
  changes: FileChanges;
  scopeViolations: string[];
  cleanup: {workspace: boolean; adapterHome: boolean; process: boolean; control: boolean};
  rawResultPath: string | null;
  artifactManifestPath: string | null;
  error?: string;
};
