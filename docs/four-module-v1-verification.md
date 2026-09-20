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
307a0a55f7ef880672840e5ac79442ef7d6995a15e18617d8afb4205b7919f25
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
91 tests passed, 0 failed

npm pack --dry-run --json
completed successfully; 398 package entries
```

The packed-install test also ran all five profiles through the installed public
CLI and checked `met`, `not_met`, and `incomplete` verdicts. No live agent or
paid-provider run was used for this verification.
