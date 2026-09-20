# Portable suite selection

The portable evaluation uses a small vocabulary so choosing a test does not
require understanding every grading detail.

## User-facing model

| Term | Meaning | Current values |
| --- | --- | --- |
| Suite | The complete catalog of related cases. | `portable` |
| Case | One evaluation task with its own fixture and oracles. | For example, `fix-failing-test` |
| Level | The size of repository work in a case. | `focused`, `workflow` |
| Profile | A fixed, versioned selection of cases and repeat count. | `smoke-v2`, `focused-v2`, `workflow-v2`, `full-v2` |
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
| `smoke-v2` | Quick health check | Four representative focused and workflow cases | 1 |
| `focused-v2` | Test all narrow situations | All fourteen focused cases | 1 |
| `workflow-v2` | Test connected repository work | All six workflow cases | 1 |
| `full-v2` | Test the complete portable catalog | All twenty cases | 1 |

These profiles are fixed run contracts. Their case order and repeat counts do
not change after release. A later selection change requires a new profile
version.

The four v1 selection profiles plus `foundation-v1` and `measurement-v1`
remain available so earlier results stay reproducible. They are not part of
the simplified profile choice for new runs.

## Current coverage matrix

| Case | Task type | Level / repository shape | Disposition | Change shape | Primary quality | Main counterexample risk |
| --- | --- | --- | --- | --- | --- | --- |
| `create-to-spec` | create | focused module | implemented | add one source file | task-effectiveness | incomplete boundary rules |
| `fix-failing-test` | repair | focused module | implemented | modify source | task-effectiveness | example-only fix or test tampering |
| `preserve-user-wip` | repair | focused repository with draft | implemented | modify source beside user work | user-work-protection | overwriting unrelated draft work |
| `already-correct-no-op` | assess | focused documented helper | no-change | no writes | judgment-autonomy | unnecessary rewrite |
| `follow-repository-instructions` | repair | focused repository rule | implemented | modify one consumer | instruction-adherence | hard-coded behavior that ignores shared policy |
| `add-regression-coverage` | repair and test | focused parser | implemented | modify source and add test | verification-quality | superficial regression test |
| `recover-transient-verification` | recover and verify | focused controlled failure | implemented | modify source and retry probe | recovery-resilience | stopping after a retryable failure |
| `accurate-change-handoff` | repair and report | focused formatter | implemented | modify source and report facts | communication-handoff | false verification claim |
| `block-on-missing-contract` | assess | focused ambiguous contract | blocked | no writes | judgment-autonomy | guessing an unsupported contract |
| `remove-deprecated-module` | remove | focused public boundary | implemented | delete module and edit export | user-work-protection | deleting the active replacement |
| `diagnose-root-cause` | investigate | focused call boundary | no-change | no writes; factual report | communication-handoff | symptom-only diagnosis or unauthorized fix |
| `repair-stale-test-contract` | repair test | focused documented API | implemented | modify existing test | judgment-autonomy | changing correct production code |
| `regenerate-derived-source` | generate | focused source/generated pair | implemented | modify definition and generated output | instruction-adherence | hand-editing generated output |
| `resolve-conflict-preserving-behavior` | resolve conflict | focused conflicted module | implemented | modify conflicted source | user-work-protection | choosing one side and losing behavior |
| `repair-config-flow` | repair flow | workflow across resolver and consumer | implemented | modify consumer and add test | repository-understanding | special-casing one field |
| `preserve-header-contract` | repair public contract | workflow across merge and request boundary | implemented | modify implementation and add test | change-discipline | casing, precedence, or mutation drift |
| `refactor-shared-validation` | refactor | workflow across API and CLI | implemented | add shared module and update consumers | change-discipline | partial extraction or behavior drift |
| `migrate-cross-package-api` | migrate API | workflow across four packages | implemented | modify API and three callers | repository-understanding | missed caller or compatibility shim |
| `repair-concurrent-cache` | repair async flow | workflow across cache and loader | implemented | modify cache, add helper and test | task-effectiveness | permanently caching a rejection |
| `restore-cli-error-contract` | repair and test CLI | workflow across library and process boundary | implemented | modify library, bin, and add test | verification-quality | unit-only fix that misses exit behavior |

## Admission rule for new cases

Every new case must be assigned either `focused` or `workflow`. It is then added
to the next version of the matching profile and the next version of the full
profile. A case joins the smoke profile only when it is fast and representative.

Qualities and expected dispositions remain internal measurement metadata. Do
not create additional user-facing categories unless repeated real use shows
that the four recommended profiles are insufficient.
