# Portable four-module suite

This directory contains the trusted, deterministic portable suite. The suite
tests agent behavior through a public CLI. Its profiles are execution
contracts, not rankings or claims of complete agent quality.

The classification model and full 25-case matrix are in
[`docs/suite-taxonomy.md`](../../docs/suite-taxonomy.md).

## Profiles

| Profile | Cases | Purpose |
| --- | ---: | --- |
| `reasoning-v1` | 7 | Active-path tracing, contract judgment, diagnosis, and repository understanding |
| `execution-v1` | 11 | Complete, safe repository changes |
| `recovery-v1` | 3 | Transient failure, unavailable tooling, and partial-work recovery |
| `verification-v1` | 4 | Regression evidence, cross-layer checks, and factual handoff |
| `full-agent-v1` | 25 | All four modules in the order above |

Every profile uses one repeat per case. The suite therefore makes no
reliability claim. Profile membership and order are validated as part of the
offline gate. Old bundled profile IDs are intentionally not accepted.

## Module inventories

### Reasoning

- `already-correct-no-op`
- `block-on-missing-contract`
- `diagnose-root-cause`
- `repair-stale-test-contract`
- `trace-actual-runtime-path`
- `repair-config-flow`
- `migrate-cross-package-api`

`trace-actual-runtime-path` adds an active CLI dispatcher and formatter beside
a plausible legacy implementation. Only the active formatter may change.

### Execution

- `create-to-spec`
- `fix-failing-test`
- `preserve-user-wip`
- `follow-repository-instructions`
- `remove-deprecated-module`
- `resolve-conflict-preserving-behavior`
- `regenerate-derived-source`
- `preserve-header-contract`
- `refactor-shared-validation`
- `repair-concurrent-cache`
- `add-timeout-option-workflow`

`add-timeout-option-workflow` is the one long-horizon case. It carries one
option through its definition, generated source, resolver, CLI, runtime
consumer, application surfaces, and regression coverage. Its limit is 300
seconds. The checks cover defaults and precedence.

### Recovery

- `recover-transient-verification`
- `fallback-after-tool-failure`
- `resume-partial-migration`

`fallback-after-tool-failure` exposes two exact controlled probes. The primary
probe records one `unavailable` event. The documented portable verifier records
one `passed` event. Extra retries fail behavior grading.

`resume-partial-migration` starts with completed core and CLI work. Those files
are protected. Only the remaining plugin and app callers may change.

### Verification

- `add-regression-coverage`
- `accurate-change-handoff`
- `restore-cli-error-contract`
- `verify-cross-layer-fix`

`verify-cross-layer-fix` requires one focused helper check and one full
consumer check. Both probes use exact event matching, and the final response
must report both results truthfully.

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

The initial workspace, solution, and counterexample pass structural admission.
The initial state must match `startState`. The solution must meet repository
and behavior rules with no scope violation. The plausible counterexample must
fail complete conformance. Known-good and known-bad evidence are reviewed and
validated against the declared behavior contract.

Allowed-write lists are exact. Existing instructions, tests, generators,
package metadata, and unrelated user work stay unchanged unless the task
explicitly includes them.

Controlled probes are generated outside the workspace:

- `command` runs the real case command.
- `transient-first` fails once and then runs the command.
- `unavailable` returns a stable unavailable result.

Cases can require outcome subsequences or an exact complete event sequence.
This grades recovery facts without requiring a product-specific tool name or
call count.

## Dimensions and boundaries

`focused` and `workflow` describe repository shape only. `short`,
`multi-stage`, and `long-horizon` describe the dependency chain. Qualities
provide detailed diagnosis. Safety is enforced across all modules.

Long-horizon means substantial connected work within one public CLI run.
Cross-session pause and resume are not covered in this suite version.

All fixture commands use checked-in files and Node.js built-ins. They do not
depend on a provider, model, permission mode, product-specific tool, or private
action trace. The fake executable proves the offline harness contract only; it
does not prove real-agent reliability.
