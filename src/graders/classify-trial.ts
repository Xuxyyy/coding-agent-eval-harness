import type {TrialRecord, TrialStatus} from '../types/index.js';

export function classifyTrial(
  terminalStatus: TrialRecord['terminalStatus'],
  repositoryPassed: boolean,
  behaviorPassed: boolean,
  harnessError?: string,
): TrialStatus {
  if (harnessError !== undefined || terminalStatus === 'error') return 'error';
  if (terminalStatus === 'completed' && repositoryPassed && behaviorPassed) return 'pass';
  return 'fail';
}
