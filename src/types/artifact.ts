import type {AdapterTerminalStatus, Usage} from './adapter.js';
import type {BehaviorGrade, ControlledEvent, GradeResult} from './case.js';
import type {TrialStatus} from './trial.js';

export const LEGACY_TRIAL_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const TRIAL_ARTIFACT_SCHEMA_VERSION = 2 as const;

export type ArtifactFileReference = {
  path: string;
  bytes: number;
  sha256: string;
  truncated: boolean;
};

export type TrialArtifact = {
  kind: 'trial-artifact';
  schemaVersion: typeof TRIAL_ARTIFACT_SCHEMA_VERSION;
  identity: {
    caseId: string;
    repeat: number;
    adapter: string;
    requestedModel: string | null;
    publicSessionId: string | null;
  };
  run: {
    startedAt: string;
    suiteContentHash: string;
    maxSecondsCap: number | null;
  };
  environment: {
    agentExecutableVersion: string;
    node: string;
    platform: string;
  };
  outcome: {
    terminalStatus: AdapterTerminalStatus;
    status: TrialStatus;
    solved: boolean;
    clean: boolean;
    repositoryPassed: boolean;
    behaviorPassed: boolean;
  };
  finalMessage: string | null;
  usage: Usage | null;
  elapsedMs: number;
  repositoryGrade: GradeResult;
  behaviorGrade: BehaviorGrade;
  controlEvents: ControlledEvent[];
  errors: string[];
  cleanup: {workspace: boolean; adapterHome: boolean; process: boolean; control: boolean};
  files: {
    stdout: ArtifactFileReference;
    stderr: ArtifactFileReference;
    events: ArtifactFileReference;
    diff: ArtifactFileReference;
  };
};

export type LegacyTrialArtifact = {
  kind: 'trial-artifact';
  schemaVersion: typeof LEGACY_TRIAL_ARTIFACT_SCHEMA_VERSION;
  identity: TrialArtifact['identity'];
  run: TrialArtifact['run'];
  environment: TrialArtifact['environment'];
  outcome: {
    terminalStatus: AdapterTerminalStatus;
    status: TrialStatus;
    solved: boolean;
    clean: boolean;
  };
  finalMessage: string | null;
  usage: Usage | null;
  elapsedMs: number;
  grade: GradeResult;
  errors: string[];
  cleanup: {workspace: boolean; adapterHome: boolean; process: boolean};
  files: TrialArtifact['files'];
};
