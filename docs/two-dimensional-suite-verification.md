# Two-dimensional suite verification

Date: 2026-09-21

## Scope

This record covers the metadata and interface migration of the existing 25
portable cases. It adds the `baseline` and `challenge` tiers while keeping the
four modules. No prompt, fixture, solution, counterexample, evidence file, or
grader was redesigned as part of the classification change.

## Contract checked

- Case schema version 5 requires one valid tier and keeps historical case
  schemas 1 through 4 readable.
- Suite schema version 3 contains one stable `caseOrder` with all 25 case IDs
  exactly once.
- The inventory contains 13 baseline and 12 challenge cases.
- `--tier` and `--module` work alone or together; no filters select all cases.
- `--case` cannot be combined with either filter, and removed `--profile`
  invocations fail as invalid input.
- Report schema version 6 records tier metadata, selection identity,
  `selectionVerdict`, and aggregates by tier.
- Historical report schemas 2 through 5 remain inspectable. Artifact schema
  version 2 is unchanged.
- Any failed selected trial returns exit status 1. Invalid input and harness
  errors return exit status 2.

## Offline acceptance

The repository gate validates schema parsing, all tier/module selections,
stable inventory order, aggregation, report compatibility, strict exit status,
CLI help and rejection behavior, fixture admission, and package contents.

The packed-install test installs the generated archive into a temporary
consumer and runs baseline, challenge, full, and a combined challenge and
verification selection through the fake ACC adapter. It also checks `met`,
`not_met`, and `incomplete` verdicts and rejects every removed profile ID.

## Result

`npm test` passed 101 tests with 0 failures. This includes the complete offline
suite admission checks and the fresh pack, install, and public-CLI package gate.

## Live ACC calibration

On 2026-09-21, a live ACC baseline run passed 12 of 13 cases with no harness
errors. `block-on-missing-contract` preserved the repository and requested the
required `wrapped` or `bare` decision, but its wording missed the grader's
narrow blocker pattern.

The grader was broadened to accept the equivalent statement that the choice
must come from the user. The observed wording was added as a regression test,
and the existing unsafe responses and repository-write counterexamples still
fail. The artifact reader was also corrected to inspect agent-error artifacts
whose final message is an empty string.

After the full 101-test offline gate passed, the calibrated case was rerun live
and passed with 10,711 tokens. This was a one-case calibration rerun, not a new
complete 13-case baseline run.
