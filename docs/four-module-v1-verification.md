# Four-module v1 verification record

Date: 2026-09-20

This record verifies the first portable suite organized around the four
agent-builder modules: reasoning, execution, recovery, and verification.

## Verified contract

- Case schema version 4 is used by all 25 portable cases.
- Suite schema version 2 defines four module profiles and one all-module
  profile.
- The module profiles contain 7 reasoning, 11 execution, 3 recovery, and 4
  verification cases.
- Every portable case appears in exactly one module profile.
- `full-agent-v1` contains all 25 cases exactly once in module order.
- Every profile requires one repeat per case.
- Report schema version 5 records module and horizon and aggregates by module.
- Report versions 2, 3, and 4 remain readable.
- Removed profile IDs return an unknown-profile error.

The verified suite content hash is:

```text
0de22439853a8ee1680e2103261df08ed54163608082625a98b3432cf0c9a414
```

## Fixture admission

All 25 cases passed the offline admission gate:

- the initial workspace matches its declared start state;
- the solution passes every repository and behavior check;
- the solution changes exactly the allowed paths for unsolved cases;
- the plausible counterexample fails complete conformance;
- known-good evidence passes;
- known-bad evidence fails.

The five added cases include complete workspace, solution, counterexample, and
reviewed evidence trees. `add-timeout-option-workflow` has a 300-second limit.
The other added workflow cases use limits from 180 to 240 seconds.

## Controlled probes

Offline tests verified all schema 4 strategies:

- `command` executes the authored verification command;
- `transient-first` records one transient failure before command execution;
- `unavailable` returns a deterministic unavailable result;
- exact event matching rejects an unwanted retry.

The fake ACC executable passed each module profile and `full-agent-v1` without
network or provider calls. It exercised the exact unavailable-to-fallback flow
and both focused and full probes in the cross-layer verification case.

## Commands and results

```text
npm test
96 tests passed, 0 failed

npm pack --dry-run --json
completed successfully; 404 package entries
```

The packed-install test also ran all five profiles through the installed public
CLI and checked `met`, `not_met`, and `incomplete` verdicts. No live agent or
paid-provider run was used for the offline acceptance evidence above.

## ACC public-release verification

One live `full-agent-v1` run used ACC 0.1.0 with requested model
`deepseek-v4-flash`. It completed all 25 trials with no harness errors and
confirmed cleanup for every workspace, adapter home, process, and controlled
probe. The run produced 24 passes and one response-grader false negative, for
a `not_met` profile verdict. It recorded 657,450 total tokens.

The failed trial, `diagnose-root-cause`, met every repository and factual
response requirement. ACC reported, “No repository files were modified,” but
the no-change pattern did not accept that equivalent wording. The contract was
narrowly corrected and covered by an offline regression assertion. A single
live rerun of that case then passed with 10,813 total tokens.

No Codex or Claude Code live calls were made. The ignored local result bundles
were inspected but are not part of the published package. A second paid
25-trial run was intentionally not used to restate the already observed 24
unaffected outcomes.
