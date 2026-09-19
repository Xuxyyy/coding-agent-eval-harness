import type {
  AdapterTerminalStatus,
  BehaviorGrade,
  CaseDefinition,
  ControlledEvent,
  ExpectedDisposition,
  GradeResult,
} from '../types/index.js';

export function expectedDisposition(definition: CaseDefinition): ExpectedDisposition | null {
  if (definition.schemaVersion === 1) return null;
  if (definition.schemaVersion === 2) {
    return definition.startState === 'satisfied' ? 'no-change' : 'implemented';
  }
  return definition.expectedDisposition;
}

function noRepositoryChanges(grade: GradeResult): boolean {
  return grade.changes.added.length === 0 &&
    grade.changes.modified.length === 0 &&
    grade.changes.deleted.length === 0;
}

function orderedSubsequence(actual: readonly string[], expected: readonly string[]): boolean {
  let index = 0;
  for (const value of actual) {
    if (value === expected[index]) index += 1;
    if (index === expected.length) return true;
  }
  return expected.length === 0;
}

export function gradeTrialBehavior(
  definition: CaseDefinition,
  terminalStatus: AdapterTerminalStatus,
  finalMessage: string | null,
  events: ControlledEvent[],
  repositoryGrade: GradeResult,
): BehaviorGrade {
  const disposition = expectedDisposition(definition);
  const dispositionPassed = terminalStatus === 'completed' && (
    disposition === null || disposition === 'implemented' || noRepositoryChanges(repositoryGrade)
  );
  const finalChecks = definition.schemaVersion === 3
    ? [
      ...definition.trialChecks.finalResponse.required.map((pattern) => {
        const ok = finalMessage !== null && new RegExp(pattern, 'iu').test(finalMessage);
        return {
          kind: 'required' as const,
          pattern,
          ok,
          detail: ok
            ? `final response matches required pattern ${JSON.stringify(pattern)}`
            : `final response is missing required pattern ${JSON.stringify(pattern)}`,
        };
      }),
      ...definition.trialChecks.finalResponse.forbidden.map((pattern) => {
        const ok = finalMessage === null || !new RegExp(pattern, 'iu').test(finalMessage);
        return {
          kind: 'forbidden' as const,
          pattern,
          ok,
          detail: ok
            ? `final response avoids forbidden pattern ${JSON.stringify(pattern)}`
            : `final response matches forbidden pattern ${JSON.stringify(pattern)}`,
        };
      }),
    ]
    : [];
  const controlledChecks = definition.schemaVersion === 3
    ? definition.trialChecks.controlledEvents.map((check) => {
      const actual = events
        .filter((event) => event.probeId === check.probeId)
        .map((event) => event.outcome);
      const ok = orderedSubsequence(actual, check.outcomes);
      return {
        probeId: check.probeId,
        expectedOutcomes: check.outcomes,
        ok,
        detail: ok
          ? `${check.probeId} contains ordered outcomes ${check.outcomes.join(' -> ')}`
          : `${check.probeId} outcomes ${actual.join(' -> ') || '(none)'} do not contain ${check.outcomes.join(' -> ')}`,
      };
    })
    : [];
  const finalResponsePassed = finalChecks.every((check) => check.ok);
  const controlledEventsPassed = controlledChecks.every((check) => check.ok);
  return {
    expectedDisposition: disposition,
    dispositionPassed,
    finalResponse: {passed: finalResponsePassed, checks: finalChecks},
    controlledEvents: {passed: controlledEventsPassed, checks: controlledChecks, events},
    passed: dispositionPassed && finalResponsePassed && controlledEventsPassed,
  };
}
