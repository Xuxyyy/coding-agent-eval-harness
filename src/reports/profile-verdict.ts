import type {ProfileVerdict, TrialRecord} from '../types/index.js';
import {repeatsComplete, type RepeatRequirement} from './shared.js';

export function profileVerdict(
  trials: readonly TrialRecord[],
  requirement: RepeatRequirement,
): ProfileVerdict {
  const requiredIds = new Set(requirement.caseIds);
  if (trials.some((trial) => !requiredIds.has(trial.caseId))) return 'incomplete';
  for (const caseId of requirement.caseIds) {
    const selected = trials.filter((trial) => trial.caseId === caseId);
    if (!repeatsComplete(selected, requirement.repeats)) return 'incomplete';
  }
  if (trials.some((trial) => trial.status === 'error')) return 'incomplete';
  return trials.every((trial) => trial.status === 'pass') ? 'met' : 'not_met';
}
