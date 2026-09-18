import type {AdapterTerminalStatus, Usage} from './adapter.js';
import type {GradeResult} from './case.js';
import type {TrialStatus} from './trial.js';

export const TRIAL_ARTIFACT_SCHEMA_VERSION = 1 as const;

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
  };
  finalMessage: string | null;
  usage: Usage | null;
  elapsedMs: number;
  grade: GradeResult;
  errors: string[];
  cleanup: {workspace: boolean; adapterHome: boolean; process: boolean};
  files: {
    stdout: ArtifactFileReference;
    stderr: ArtifactFileReference;
    events: ArtifactFileReference;
    diff: ArtifactFileReference;
  };
};
