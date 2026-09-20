# Portable suite selection

The portable evaluation uses a small vocabulary so choosing a test does not
require understanding every grading detail.

## User-facing model

| Term | Meaning | Current values |
| --- | --- | --- |
| Suite | The complete catalog of related cases. | `portable` |
| Case | One evaluation task with its own fixture and oracles. | For example, `fix-failing-test` |
| Level | The size of repository work in a case. | `focused`, `workflow` |
| Profile | A fixed, versioned selection of cases and repeat count. | `smoke-v1`, `focused-v1`, `workflow-v1`, `full-v1` |
| Run | One execution of a profile or explicit case selection against an agent. | A result JSONL file and its artifacts |

The normal selection flow is:

```text
portable suite
  -> choose smoke, focused, workflow, or full
  -> run the profile against one agent
  -> inspect the report or one trial
```

## Case levels

`focused` isolates one narrow situation and its principal risk. It may touch
more than one file when that is necessary to make the risk realistic.

`workflow` requires connected reasoning across multiple repository boundaries,
such as a shared resolver and its consumer or a public API and its internal
implementation. File count alone does not make a case a workflow.

These are the only user-facing case categories. The schema also records quality,
start state, and expected disposition because the grader and report need them,
but users do not need those fields to choose which part of the suite to run.

## Recommended profiles

| Profile | Purpose | Cases | Repeats |
| --- | --- | --- | ---: |
| `smoke-v1` | Quick health check | Three representative focused cases | 1 |
| `focused-v1` | Test all narrow situations | All ten focused cases | 1 |
| `workflow-v1` | Test connected repository work | Both workflow cases | 1 |
| `full-v1` | Test the complete portable catalog | All twelve cases | 1 |

These profiles are fixed run contracts. Their case order and repeat counts do
not change after release. A later selection change requires a new profile
version.

`foundation-v1` and `measurement-v1` remain available as legacy profiles so
earlier results stay reproducible. They are not part of the simplified profile
choice for new runs.

## Current case matrix

| Case | Level | Recommended profiles |
| --- | --- | --- |
| `create-to-spec` | focused | smoke, focused, full |
| `fix-failing-test` | focused | focused, full |
| `preserve-user-wip` | focused | smoke, focused, full |
| `already-correct-no-op` | focused | smoke, focused, full |
| `follow-repository-instructions` | focused | focused, full |
| `add-regression-coverage` | focused | focused, full |
| `recover-transient-verification` | focused | focused, full |
| `accurate-change-handoff` | focused | focused, full |
| `block-on-missing-contract` | focused | focused, full |
| `remove-deprecated-module` | focused | focused, full |
| `repair-config-flow` | workflow | workflow, full |
| `preserve-header-contract` | workflow | workflow, full |

## Admission rule for new cases

Every new case must be assigned either `focused` or `workflow`. It is then added
to the next version of the matching profile and the next version of the full
profile. A case joins the smoke profile only when it is fast and representative.

Qualities and expected dispositions remain internal measurement metadata. Do
not create additional user-facing categories unless repeated real use shows
that the four recommended profiles are insufficient.
