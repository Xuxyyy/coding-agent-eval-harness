import type {Aggregate, CaseQuality, Rate, TrialRecord} from '../types/index.js';
import {repeatsComplete, type RepeatRequirement} from './shared.js';

function rate(count: number, of: number): Rate {
  return {count, of, rate: of === 0 ? null : count / of};
}

function orderedUnique<T>(values: readonly T[]): T[] {
  const result: T[] = [];
  for (const value of values) if (!result.includes(value)) result.push(value);
  return result;
}

export function aggregate(
  trials: readonly TrialRecord[],
  requirement?: RepeatRequirement,
): Aggregate {
  const scored = trials.filter((trial) => trial.status !== 'error');
  const ids = requirement?.caseIds === undefined
    ? orderedUnique(trials.map((trial) => trial.caseId))
    : [...requirement.caseIds];
  const qualities = orderedUnique(
    trials
      .map((trial) => trial.primaryQuality)
      .filter((quality): quality is CaseQuality => quality !== null),
  );
  return {
    total: trials.length,
    scored: scored.length,
    errors: trials.length - scored.length,
    passes: rate(scored.filter((trial) => trial.status === 'pass').length, scored.length),
    solved: rate(scored.filter((trial) => trial.solved).length, scored.length),
    clean: rate(scored.filter((trial) => trial.clean).length, scored.length),
    byCase: ids.map((id) => {
      const selected = trials.filter((trial) => trial.caseId === id);
      const kept = selected.filter((trial) => trial.status !== 'error');
      return {
        id,
        total: selected.length,
        required: requirement?.repeats ?? null,
        complete: requirement === undefined
          ? null
          : repeatsComplete(selected, requirement.repeats),
        scored: kept.length,
        errors: selected.length - kept.length,
        passes: kept.filter((trial) => trial.status === 'pass').length,
      };
    }),
    byPrimaryQuality: qualities.map((quality) => {
      const selected = trials.filter((trial) => trial.primaryQuality === quality);
      const kept = selected.filter((trial) => trial.status !== 'error');
      return {
        quality,
        total: selected.length,
        scored: kept.length,
        errors: selected.length - kept.length,
        passes: rate(kept.filter((trial) => trial.status === 'pass').length, kept.length),
      };
    }),
  };
}
