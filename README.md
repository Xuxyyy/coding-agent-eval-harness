# Coding Agent Eval Harness

Coding Agent Eval Harness is a portable, deterministic evaluation tool for
coding-agent CLIs. It was originally built to evaluate
[ACC](https://github.com/Xuxyyy/terminal-coding-agent) and now provides the
same repository tasks, grading rules, and evidence model for ACC, Codex, and
Claude Code.

The harness evaluates the agent through its public CLI. It does not import the
agent's internals. Each trial starts from a fresh temporary Git repository,
runs one bounded task, grades the resulting repository and final response, and
writes an auditable result bundle.

The bundled suite is an evaluation foundation. It is not a leaderboard or a
claim of complete agent quality.

## What it measures

The 25 portable cases use two independent dimensions. The tier describes the
expected difficulty:

- `baseline`: 13 capabilities a coding agent is expected to pass.
- `challenge`: 12 harder cases used to expose limits and diagnose failures.

The module describes the kind of capability:

- `reasoning`: understand the active code path, contract, and correct action.
- `execution`: make a complete repository change with controlled scope.
- `recovery`: respond safely to failed tools and partially completed work.
- `verification`: gather enough evidence and report the result accurately.

Cases also record fixture level, dependency horizon, primary quality, and
supporting qualities. Safety rules protect user work, repository instructions,
tests, generators, and unrelated files across every module.

See the [suite taxonomy](docs/suite-taxonomy.md) and
[portable suite reference](suites/portable/README.md) for the complete case
matrix.

## Built-in adapters

| Adapter | CLI | Role |
| --- | --- | --- |
| `acc` | `acc` | Original custom-agent integration and primary real-world verification target |
| `codex` | `codex` | Additional built-in coding-agent integration |
| `claude` | `claude` | Additional built-in coding-agent integration |

This release supports these three adapters only. It does not define a public
plugin or third-party adapter protocol.

## Requirements

- Node.js 22 or newer
- Git
- macOS or Linux
- A supported agent CLI for live evaluation

Install and run the offline gate:

```sh
git clone https://github.com/Xuxyyy/coding-agent-eval-harness.git
cd coding-agent-eval-harness
npm ci
npm test
```

Tests use local fake executables. They do not call an agent, model, provider,
network service, or paid API.

## Run the portable suite

Build the CLI, then select a tier, a module, both, or neither:

```sh
npm run build
node dist/cli/index.js run \
  --agent acc \
  --command "$(command -v acc)" \
  --suite portable \
  --tier baseline \
  --module reasoning
```

With no filters, the CLI runs all 25 cases. One filter selects every matching
case. Both filters select their intersection. `--repeats` works with filters;
`--case` does not.

Convenience scripts are available for every built-in adapter and tier:

```sh
npm run -s eval:baseline:acc
npm run -s eval:challenge:codex
npm run -s eval:full:acc
```

Module-specific selections use the CLI flags directly.

These commands use the agent CLI's configured default model. Use `--model`
with the main CLI when an exact model is part of the evaluation identity.
Live runs use the authentication already available to the selected CLI and may
consume provider credit.

For an ad hoc selection, use `--case` and `--repeats` without tier or module
filters:

```sh
node dist/cli/index.js run \
  --agent acc \
  --command "$(command -v acc)" \
  --suite portable \
  --case create-to-spec \
  --repeats 1
```

Use `--cases <directory>` instead of `--suite portable` to run a trusted custom
suite. The two options are mutually exclusive. The command value is one
executable path or name and is never evaluated as a shell command.

## Results and inspection

The CLI prints progress and a compact summary:

```text
case                         repeat  status  solved  clean  terminal   elapsed_ms  total_tokens
create-to-spec               1       pass    true    true   completed  8200        14000
...
selection  tier baseline  module reasoning  verdict met
result   <path>/results/<timestamp>-acc.jsonl
```

Inspect one exact trial and its structured evidence:

```sh
node dist/cli/index.js inspect \
  --result results/<run>.jsonl \
  --case create-to-spec \
  --repeat 1
```

Inspection shows identity, tier, module, horizon, disposition, terminal status,
final message, normalized public events, Git diff, repository checks, behavior
checks, cleanup, and artifact paths.

Selection verdicts are:

- `met`: every required trial passed.
- `not_met`: all evidence exists and at least one required trial failed.
- `incomplete`: a required trial is missing or has an evidence error.

Every run has a selection verdict. The harness does not calculate a weighted
overall score.

## Evidence model

New runs write report schema version 6 and artifact schema version 2. The
reader also accepts historical report versions 2 through 5.

Each immutable trial bundle contains:

- raw stdout and stderr bytes;
- normalized public agent events;
- a bounded binary-capable Git patch;
- repository and response grades;
- controlled verification events;
- checksums, timing, errors, and cleanup evidence.

Provider-private reasoning is never stored. A provider or harness error never
disappears from a favorable denominator.

## Case contract

Each portable case contains a manifest, initial workspace, reviewed solution,
plausible counterexample, and known-good and known-bad evidence. Admission
checks prove that the starting state, solution, counterexample, and evidence
match the declared contract before the case can run.

Repository checks support `exists`, `absent`, `contains`, `matches`, `exit0`,
and `unchanged`. Allowed writes are exact. Controlled probes can run a real
verification command, fail once before succeeding, or return a deterministic
unavailable result.

## Trust boundaries and limitations

- Suites and their fixture commands are trusted code. Do not run an unreviewed
  suite.
- The agent works in a temporary repository, but the harness does not prove
  that an arbitrary executable cannot act outside that directory.
- Credentials are not copied. Adapters use the selected CLI's existing local
  authentication.
- Live agent runs are intentionally excluded from tests and CI.
- One trial per selected case does not establish reliability.
- Long-horizon means connected work within one CLI run. Cross-session pause
  and resume are not covered.
- Grading does not require a product-specific tool name or tool-call count.

## Development and verification

```sh
npm run build
npm test
npm pack --dry-run --json
```

The package test installs the generated archive in a temporary consumer,
executes baseline, challenge, full, and combined selections through the public
CLI, verifies verdict distinctions, and checks that private or temporary files
are excluded.

See the [documentation index](docs/README.md) for the current design references
and historical verification records. The latest offline acceptance evidence is
the [two-dimensional suite verification record](docs/two-dimensional-suite-verification.md).

## License

MIT
