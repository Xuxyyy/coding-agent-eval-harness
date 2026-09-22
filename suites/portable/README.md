# Portable two-dimensional suite

This directory contains the trusted, deterministic 25-case portable suite.
It tests agent behavior through a public CLI. It is an evaluation foundation,
not a ranking or a claim of complete agent quality.

The full matrix is in
[`docs/suite-taxonomy.md`](../../docs/suite-taxonomy.md).

## Selection

Cases have two independent fields:

- `tier`: `baseline` (13) or `challenge` (12).
- `primaryModule`: `reasoning`, `execution`, `recovery`, or `verification`.

Use `--tier`, `--module`, both, or neither. Both filters use intersection
semantics. The suite manifest records every case exactly once in stable order.
The removed profile IDs are not accepted for new runs.

## Inventory

| Tier | Reasoning | Execution | Recovery | Verification |
| --- | ---: | ---: | ---: | ---: |
| baseline | 3 | 6 | 2 | 2 |
| challenge | 4 | 5 | 1 | 2 |
| total | 7 | 11 | 3 | 4 |

The baseline tier contains the core expected behaviors. The challenge tier
contains harder cases that are useful for failure analysis. This split does not
change any task, fixture, evidence, or grading rule.

`add-timeout-option-workflow` is the only long-horizon case. It carries one
option through definition, generated source, resolver, CLI, runtime consumer,
application surfaces, and regression coverage. Cross-session pause and resume
are not covered.

## Fixture contract

Every case contains:

```text
case.json
workspace/
solution/
counterexample/
evidence/
  known-good.json
  known-bad.json
```

Admission checks validate the starting state, reviewed solution, plausible
counterexample, and evidence. Allowed-write lists are exact. Existing
instructions, tests, generators, package metadata, and unrelated user work stay
unchanged unless the task explicitly includes them.

Controlled probes are generated outside the workspace:

- `command` runs the real case command.
- `transient-first` fails once and then runs the command.
- `unavailable` returns a stable unavailable result.

Cases can require an outcome subsequence or an exact complete event sequence.
This grades recovery facts without requiring a product-specific tool name or
call count.

All fixture commands use checked-in files and Node.js built-ins. They do not
depend on a provider, model, permission mode, or private action trace. The fake
executable proves the offline harness contract only; it does not prove live
agent reliability.
