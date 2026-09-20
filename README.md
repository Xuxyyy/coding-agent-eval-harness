# Agent Eval Harness

Agent Eval Harness tests coding agents through their public CLI. It asks whether
an agent can understand repository work, make safe changes, recover from tool
problems, and verify the result truthfully.

The harness is a standalone Node.js tool. It runs trusted, deterministic
fixtures through neutral adapters. It never imports a tested product's
internals. The bundled portable suite is an evaluation foundation, not a
leaderboard or complete certification.

## Four-module evaluation model

Every portable case belongs to exactly one agent-builder module:

- `reasoning`: understand the real code path, contract, and right action.
- `execution`: make the required repository change with controlled scope.
- `recovery`: respond safely to failed tools or partially completed work.
- `verification`: gather enough evidence and report it accurately.

Four other dimensions remain separate:

- `level` describes fixture shape: `focused` or `workflow`.
- `horizon` describes dependency length: `short`, `multi-stage`, or
  `long-horizon`.
- `primaryQuality` and `supportingQualities` provide detailed diagnosis.
- safety rules protect user work, instructions, tests, generators, and
  unrelated files across every module.

The portable suite has 25 cases. Each bundled profile runs one trial per case,
so it makes no reliability claim. See
[the suite taxonomy](docs/suite-taxonomy.md) and
[the portable suite record](suites/portable/README.md). The offline acceptance
evidence is preserved in the
[four-module verification record](docs/four-module-v1-verification.md).

## Requirements and offline gate

- Node.js 22 or newer
- Git
- macOS or Linux

```sh
npm install
npm test
npm pack --dry-run --json
```

Tests and package checks use a fake executable. They do not call a model,
provider, ACC, Codex, or Claude Code. They need no network access.

## Run a profile

Build first, then select one module or the full suite:

```sh
npm run build
node dist/cli/index.js run \
  --agent acc \
  --command "$(command -v acc)" \
  --cases suites/portable \
  --profile reasoning-v1
```

The five profile IDs are:

- `reasoning-v1`: seven cases.
- `execution-v1`: eleven cases.
- `recovery-v1`: three cases.
- `verification-v1`: four cases.
- `full-agent-v1`: all 25 cases, ordered by module and dependency complexity.

Use the matching npm shortcuts for ACC, Codex, or Claude Code:

```sh
npm run -s eval:reasoning:acc
npm run -s eval:execution:codex
npm run -s eval:recovery:claude
npm run -s eval:verification:acc
npm run -s eval:full:codex
```

These commands make live provider calls and may consume account credit. ACC
shortcuts use `deepseek-v4-flash`. Codex shortcuts use `gpt-5.6-luna`. Claude
Code shortcuts use its configured default model.

Old bundled profile IDs are not aliases. They return an unknown-profile error.
Historical result files remain readable.

Profile order and repeat count are versioned. `--profile` cannot be combined
with `--case` or `--repeats`. `--max-seconds` may lower a case limit without
changing profile identity, and the report records that cap.

Ad hoc runs are also available:

```sh
node dist/cli/index.js run \
  --agent codex \
  --command "$(command -v codex)" \
  --cases suites/portable \
  --case create-to-spec \
  --repeats 1
```

The command value is passed to the operating system as one executable. It is
never evaluated as a shell command.

Inspect one exact trial:

```sh
agent-eval inspect \
  --result results/run.jsonl \
  --case create-to-spec \
  --repeat 1
```

Inspection shows module, horizon, primary quality, disposition, status, final
message, events, patch, checks, cleanup, and artifact paths.

## Case and suite contracts

Each case directory contains `case.json`, `workspace/`, `solution/`,
`counterexample/`, and reviewed `evidence/`. Current portable cases use schema
version 4:

```json
{
  "schemaVersion": 4,
  "id": "example-case",
  "level": "focused",
  "primaryModule": "execution",
  "horizon": "short",
  "primaryQuality": "task-effectiveness",
  "supportingQualities": ["change-discipline"],
  "startState": "unsolved",
  "expectedDisposition": "implemented",
  "task": {
    "prompt": "Fix the behavior described by the repository.",
    "maxSeconds": 120
  },
  "grade": {
    "allowedWrites": ["src/example.js"],
    "checks": [
      {"kind": "exit0", "command": "node --test"},
      {"kind": "unchanged", "path": "test/example.test.js"}
    ]
  }
}
```

Repository checks support `exists`, `absent`, `contains`, `matches`, `exit0`,
and `unchanged`. Allowed writes are exact. Unsafe paths, symlinks, duplicate
metadata, and unknown fields are rejected.

Schema 4 behavior checks can require or forbid final-response facts. Controlled
probes support three strategies:

- `command`: run the real authored verification command.
- `transient-first`: fail once, then run the command.
- `unavailable`: return a deterministic unavailable result.

Probe outcomes can use subsequence or exact matching. Exact matching detects
unwanted retries. Probe events live outside the editable workspace and are
copied into the immutable trial artifact after validation.

The initial workspace, known-good solution, and known-bad counterexample must
pass admission checks. An `unsolved` workspace initially fails an outcome
check. A `satisfied` workspace already meets its repository contract. The
solution must pass and remain within scope. The counterexample must fail full
repository and behavior conformance.

The portable `suite.json` uses schema version 2. Each profile records its
module, exact ordered case IDs, and repeat count. Every case must appear once
across the four module profiles. `full-agent-v1` must contain their exact
concatenation.

External case schemas 1–3 and suite schema 1 remain readable for ad hoc and
historical use. They cannot weaken the current portable suite contract.

## Reports and verdicts

New runs write report schema version 5 and artifact schema version 2. Trials
record `primaryModule`, `horizon`, quality metadata, repository and behavior
grades, final changes, evidence paths, and cleanup. Aggregates include both
`byPrimaryModule` and `byPrimaryQuality`.

The reader continues accepting report versions 2–4. Version 2 reports have
limited inspection because structured artifacts did not yet exist.

Each trial uses a fresh temporary Git repository. Its immutable bundle stores
raw stdout and stderr bytes, normalized public events, a bounded binary-capable
Git patch, checksums, grades, controlled events, timing, errors, and cleanup.
Provider private reasoning is never stored.

Profile verdicts are:

- `met`: every required trial passed.
- `not_met`: all evidence exists and at least one trial failed.
- `incomplete`: a required trial is missing or has an evidence error.

An error never disappears from a favorable denominator. Ad hoc runs have no
profile verdict. The harness does not calculate a weighted overall score.

## Trust and live-use boundaries

Case commands and fixtures are trusted repository input. Do not run an
unreviewed suite. The selected executable can write inside a temporary task
workspace; the harness does not prove it cannot act outside that workspace.

The harness does not copy credentials. Adapters use the authentication already
available to their public CLI. Live runs may consume paid provider usage. Live
runs are never part of tests or CI.

Portable grading uses discovered facts, safe changes, deterministic repository
checks, and verification evidence. It does not require a product-specific tool
name or call count.

## Add an adapter or case

An adapter implements `AgentAdapter` in `src/adapters/types.ts`. It must use
bounded execution, normalize one terminal result, capture public evidence, and
clean up owned resources.

Start new cases from a user situation and risk. Assign one primary module and
one horizon. Record the success oracle, protected work, known-good behavior,
known-bad behavior, and bounded claim. Update the exact module profile and the
full profile when the case is admitted.
