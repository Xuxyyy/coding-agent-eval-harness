import {loadCases, loadSuite} from '../suites/cases.js';
import type {SelectedCases} from '../types/index.js';

export type SelectionOptions = {
  casesDir: string;
  caseIds?: string[];
  repeats?: number;
  profile?: string;
};

export function selectCases(options: SelectionOptions): SelectedCases {
  const all = loadCases(options.casesDir);
  if (options.profile !== undefined) {
    if (options.caseIds !== undefined || options.repeats !== undefined) {
      throw new Error('profile cannot be combined with case or repeats overrides');
    }
    const suite = loadSuite(options.casesDir, all);
    const selectedProfile = suite.profiles.find((profile) => profile.id === options.profile);
    if (selectedProfile === undefined) throw new Error(`unknown profile: ${options.profile}`);
    const byId = new Map(all.map((item) => [item.id, item]));
    return {
      cases: selectedProfile.caseIds.map((id) => byId.get(id)!),
      repeats: selectedProfile.repeats,
      profile: {
        suiteId: suite.id,
        profileId: selectedProfile.id,
        caseIds: [...selectedProfile.caseIds],
        repeats: selectedProfile.repeats,
      },
    };
  }

  const repeats = options.repeats ?? 1;
  if (!Number.isInteger(repeats) || repeats <= 0) {
    throw new Error('repeats must be a positive integer');
  }
  if (options.caseIds === undefined || options.caseIds.length === 0) {
    return {cases: all, repeats, profile: null};
  }
  const requested = new Set(options.caseIds);
  const selected = all.filter((item) => requested.has(item.id));
  const missing = [...requested].filter((id) => !selected.some((item) => item.id === id));
  if (missing.length > 0) throw new Error(`unknown case id(s): ${missing.join(', ')}`);
  return {cases: selected, repeats, profile: null};
}
