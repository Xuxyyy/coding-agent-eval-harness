import type {TrialRecord, TrialStatus} from '../types/index.js';

export function classifyTrial(
  terminalStatus: TrialRecord['terminalStatus'],
  solved: boolean,
  clean: boolean,
  harnessError?: string,
): TrialStatus {
  if (harnessError !== undefined || terminalStatus === 'error') return 'error';
  if (terminalStatus === 'completed' && solved && clean) return 'pass';
  return 'fail';
}
