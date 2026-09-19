# Agent Eval Harness

Agent Eval Harness asks a user-centered question: can a coding-agent product
complete useful repository work correctly, safely, and consistently through
its public CLI?

It is a standalone Node.js harness. It runs trusted, deterministic fixtures
through neutral adapters and never imports a tested product's internals. The
bundled `foundation-v1` profile is a draft foundation. It is not complete
certification, a leaderboard, or an overall ranking.

## Evaluation model

The standard has four layers:

1. **Standard and evidence trust** — offline tests prove the fixture, grader,
   known-good solution, known-bad counterexample, report, and cleanup.
2. **Focused product behaviors** — small cases isolate one primary quality.
3. **User journeys** — workflow cases cover bounded end-to-end repository work.
4. **Public-boundary evidence health** — adapters prove launch, authoritative
   completion, bounded execution, evidence persistence, and cleanup.

Version 2 cases use nine controlled qualities: `task-effectiveness`,
`repository-understanding`, `change-discipline`, `user-work-protection`,
`instruction-adherence`, `verification-quality`, `judgment-autonomy`,
`recovery-resilience`, and `communication-handoff`. Reliability is
cross-cutting and comes from a profile's repeat requirement, not one fixture.

The current eight-case suite contains six focused cases and two workflow cases.
It covers seven distinct qualities as primary evidence, including repository
understanding and change discipline through the workflow cases.
Recovery/resilience and communication/handoff are uncovered. This is an
intermediate milestone, not `product-v1` or complete certification. These
limits remain visible in [the suite design record](suites/portable/README.md).

## Requirements and offline gate

- Node.js 22 or newer
- Git
- macOS or Linux

Install and run the offline gate:

```sh
npm install
npm test
npm pack --dry-run --json
```

Tests and package verification use fake executables. They do not call a model,
provider, ACC, Codex, or Claude Code, and they do not require network access.

## Run a profile

Build first. Then select a trusted cases directory and a named profile:

```sh
npm run build
node dist/cli/index.js run \
  --agent acc \
  --command "$(command -v acc)" \
  --cases suites/portable \
  --profile smoke-v1
```

Use an agent-specific shortcut for a bundled profile. Each shortcut builds the
harness first:

```sh
npm run -s eval:smoke:acc
npm run -s eval:smoke:codex
npm run -s eval:smoke:claude
npm run -s eval:foundation:acc
npm run -s eval:foundation:codex
npm run -s eval:foundation:claude
npm run -s eval:workflow:acc
npm run -s eval:workflow:codex
npm run -s eval:workflow:claude
```

These commands make live provider calls and can consume account credit. The
ACC shortcuts explicitly use `deepseek-v4-flash`, and the Codex shortcuts use
`gpt-5.6-luna`. The Claude Code shortcuts use the CLI's configured default
model. Use `smoke` for a quick three-trial check and `foundation` for the full
18-trial focused baseline. Use `workflow` for the two repository workflows;
each workflow runs once and the profile makes no reliability claim.

The bundled profiles are:

- `smoke-v1`: three cases, one trial each.
- `foundation-v1`: six cases, three trials each.
- `workflow-v1`: two workflow cases, one trial each, in reviewed order.

Profile order and repeat counts are part of the versioned contract.
`--profile` cannot be combined with `--case` or `--repeats`. `--max-seconds`
may lower a case limit without changing profile identity, and the cap is
recorded in the report.

Ad hoc runs remain available:

```sh
node dist/cli/index.js run \
  --agent codex \
  --command "$(command -v codex)" \
  --cases suites/portable \
  --case create-to-spec \
  --repeats 1
```

The packaged executable uses the same interface:

```text
agent-eval run --agent acc|codex|claude --command <executable> --cases <directory> [options]
```

The command value is passed directly to the operating system as one
executable. It is not evaluated as a shell command.

Inspect one exact trial after a run:

```sh
agent-eval inspect \
  --result results/2026-01-01T00-00-00-000Z-codex.jsonl \
  --case create-to-spec \
  --repeat 1
```

Inspection prints bounded sections for identity, status, the final message,
canonical events, the final Git patch, file changes, checks, errors, cleanup,
and artifact paths. A readable capability failure still exits 0. Invalid CLI
input, selection, schema, or artifacts exit 2. Version 2 results remain
inspectable, but explain that structured artifacts are unavailable.

## Case and profile contracts

Every case directory contains `case.json`, `workspace/`, `solution/`, and
`counterexample/`. A version 2 case has explicit semantics:

```json
{
  "schemaVersion": 2,
  "id": "example-case",
  "level": "focused",
  "primaryQuality": "task-effectiveness",
  "supportingQualities": ["change-discipline"],
  "startState": "unsolved",
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

Version 2 supports `exists`, `absent`, `contains`, `matches`, `exit0`, and
`unchanged`. Paths are normalized workspace-relative paths. Allowed writes are
exact. Unknown fields, unsafe paths, malformed regular expressions, duplicate
metadata, missing fixture directories, and symlinks are rejected.

`startState` is evidence-bearing. An `unsolved` workspace must initially fail
an outcome check. A `satisfied` workspace must already solve every check and
stay unchanged. Every solution must solve and remain clean. Every
counterexample must fail solved-and-clean conformance.

External version 1 cases still load for ad hoc runs. They retain their original
`category` field and the `exists`, `exit0`, and `unchanged` checks. A version 1
case cannot join a versioned profile because it lacks quality and starting-state
semantics.

The suite root contains `suite.json`. It defines ordered case IDs and required
repeats for each named profile. Strict validation rejects unknown or legacy
cases, empty or duplicate selections, duplicate profile IDs, non-positive
repeats, and unknown fields.

## Reports and verdicts

Each trial uses a fresh temporary Git repository. New runs use report schema
version 3. It records case semantics, selected profile identity or `null`, ordered case
IDs, required repeats, an optional time cap, exact changes, deterministic
checks, cleanup, artifact schema and root, case schema versions, per-case
completeness, and results by primary quality. The public reader accepts report
schema version 2 for limited inspection compatibility.

Each version 3 trial links to an immutable manifest-backed bundle beside the
result file. A typical layout is:

```text
run.jsonl
run.artifacts/
  cases/
    create-to-spec/
      repeat-1/
        manifest.json
        stdout.bin
        stderr.bin
        events.jsonl
        final.patch
```

`stdout.bin` and `stderr.bin` preserve captured provider bytes exactly, up to
the existing process limits. `events.jsonl` is a portable diagnostic view of
public assistant messages, tool calls and results when exposed, usage,
terminal state, and unknown public events. It excludes private reasoning.
`final.patch` is a bounded binary-capable Git patch containing additions,
modifications, and deletions. The manifest stores file sizes, SHA-256 digests,
truncation flags, execution identity, the final message, deterministic grade,
errors, timing, and cleanup.

Profile verdicts are:

- `met`: every required trial passed.
- `not_met`: the evidence set is complete and at least one trial failed.
- `incomplete`: a required trial is missing or has an evidence error.

An error never disappears from a favorable capability denominator. Ad hoc runs
have no conformance verdict. The report keeps `solved`, `clean`, `pass`, `fail`,
and `error` distinct and does not calculate a weighted overall score.

Raw streams, canonical events, patches, manifests, and reports go to ignored
`results/` by default. They may contain model output, source code, local paths,
or other sensitive repository evidence. Review access and retention before a
live run, and do not commit these files.

## Trust and live-use boundaries

Case commands and fixture content are trusted repository input. Do not run a
downloaded or unreviewed suite. The harness grants the selected executable
write access inside a temporary task workspace. It does not prove that a
product cannot act outside that workspace.

The harness does not read, copy, or save credentials. ACC gets a temporary
adapter home and inherits credentials already present in the launching
environment. Codex uses its normal authentication home with ephemeral public
CLI settings. Claude Code uses its normal authentication environment with safe
mode and session persistence disabled. Its adapter bypasses interactive
permission prompts, so run only trusted suites. A live run can consume a
provider account or product allowance; live runs are never part of tests or CI.

Portable evidence excludes product-specific tool names and ordering, private
reasoning, permission modes, interactive UI behavior, provider-specific
metrics, and subjective style. Product-specific adapter checks may establish
evidence health, but they do not become shared coding-quality criteria.
Trajectory evidence is diagnostic. Deterministic outcome grading remains
authoritative, and transcript events are not portable conformance scoring.

## Add an adapter or case

An adapter implements `AgentAdapter` in `src/adapters/types.ts`. It must build
an argument array, use bounded execution, normalize one terminal result, label
usage, and confirm owned-resource cleanup. Protocol rules stay in the adapter.

New cases start from a user situation and risk, not an existing product's case
taxonomy. Record the success oracle, protection oracle, known-good behavior,
known-bad behavior, and bounded claim. Update the exact inventory, profile, and
coverage gates when the scenario is admitted.

## Provenance

Some small fixture files were reused after scenario-first review from the
separate, read-only `coding-cli` repository. The source is documented for
maintenance and byte-level provenance only. It is not read at runtime and does
not define this harness's evaluation standard.
