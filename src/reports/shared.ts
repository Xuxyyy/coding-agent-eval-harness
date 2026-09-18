import type {TrialRecord} from '../types/index.js';

export type RepeatRequirement = {caseIds: readonly string[]; repeats: number};

export function repeatsComplete(trials: readonly TrialRecord[], repeats: number): boolean {
  if (trials.length !== repeats) return false;
  const seen = new Set(trials.map((trial) => trial.repeat));
  if (seen.size !== repeats) return false;
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    if (!seen.has(repeat)) return false;
  }
  return true;
}
