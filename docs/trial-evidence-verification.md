# Structured trial evidence verification

Date: 2026-09-18

This record covers report schema version 3, trial artifact schema version 1,
canonical public events, bounded evidence persistence, and the public `inspect`
command. Every gate used local fixtures and fake executables. No live agent,
model, provider, network request, paid API, or production service was used.

## Phase gates

| Phase | Gate | Result |
| --- | --- | --- |
| 1 — evidence contracts | Build plus focused adapter and artifact tests | 16 passed, 0 failed |
| 2 — evidence persistence | Build plus artifact and runner tests | 10 passed, 0 failed |
| 3 — public inspection | Planned focused adapter, artifact, runner, and CLI command | 31 passed, 0 failed |
| Complete offline gate | `env npm_config_cache=/tmp/agent-eval-harness-npm-cache npm test` | 57 passed, 0 failed |
| Dry package gate | `env npm_config_cache=/tmp/agent-eval-harness-npm-cache npm pack --dry-run --json` | 77 entries; no forbidden files |
| Independent packed CLI | Fresh offline install and installed Codex `run` then `inspect` | Passed |

Focused tests covered canonical event kinds, unknown public events, reasoning
exclusion, terminal failures, exact adapter arguments, raw byte preservation,
unsafe and inconsistent artifacts, event ordering, version 2 fallback, binary
patches, truncation, unique repeats, persistence failures, cleanup, relocation,
bounded inspection, capability failures, and selection errors.

The complete gate retained all six cases, both profiles, their ordering and
repeat counts, every verdict distinction, deterministic grading, and workspace,
adapter-home, and process cleanup. The installed-package test ran both profiles
and inspected a passing trial through the installed executable.

## Package evidence

The final dry pack reported package `agent-eval-harness@0.1.0`, 77 entries,
and included `dist/evidence/artifacts.js` and `dist/evidence/artifacts.d.ts`. It excluded the
source tree, plans, results, harness test builds, `.env` files, credentials,
secrets, and tarballs. The package contained the six reviewed fixture trees and
the public runtime needed by both `run` and `inspect`.

## Independent packed Codex gate

A general subagent acted only as a black-box verifier. It did not import
internal TypeScript functions or modify production files. It packed the
code-frozen working tree into a fresh temporary directory, installed it
offline, created a fake public Codex executable, and used only the installed
`agent-eval` binary. The tarball SHA-256 was
`b4c954f977505fcd34ccb2ebb8acad1cb9908bb354dcc67c898ae474866e5b96`.

The installed package version was `0.1.0`. Its help displayed both public
commands. The boundary invocation was equivalent to:

```text
agent-eval run --agent codex --command <fake-codex> \
  --cases <installed-package>/suites/portable \
  --case create-to-spec --repeats 1 --output <temporary>/run.jsonl
```

The command exited 0 and printed one passing, solved, clean, completed trial
plus a completed report with one pass and zero errors. The fake executable saw
the unchanged Codex public argument boundary: approval `never`, sandbox
`workspace-write`, the fixture passed after `--cd`, and ephemeral JSON
execution with user config and rules ignored.

The verifier observed:

- Report schema 3 and artifact schema 1.
- Relative stdout and manifest links beneath
  `run.artifacts/cases/create-to-spec/repeat-1/`.
- Matching case, repeat, adapter, and public session identity.
- Completed/pass outcome, labeled token usage, elapsed time, and all cleanup
  flags true.
- Two passing deterministic checks, only `src/slugify.js` added, and no scope
  violations.
- Canonical event order `other`, `tool_call`, `tool_result`,
  `assistant_message`, `usage`, `terminal`, with contiguous sequences, exact
  final provider type `turn.completed`, and no private reasoning.
- A final Git patch containing the expected `src/slugify.js` addition.
- Byte-identical captured stdout and nonempty stderr.
- Matching manifest byte counts and SHA-256 digests for stdout, stderr, events,
  and diff.
- Removal of the temporary fixture workspace and no surviving fake process.

Installed `inspect` exited 0 and displayed every planned section. Moving the
result and artifact directory together preserved successful inspection. A copy
whose manifest link was changed to `../outside-sentinel.json` exited 2 with a
normalized-relative-path error before the outside sentinel was parsed. The
valid relocated bundle remained readable.

The verifier deleted its complete temporary consumer tree and confirmed that it
no longer existed. No production file was modified, staged, or committed by the
verifier.

## Repository and privacy evidence

Work ran on `codex/trial-evidence-layer`. Changed-file inspection found no
credential, token, private-key, password, `.env`, result bundle, tarball, or
unexpected generated file. The implementation did not modify `.claude/` or any
fixture workspace source. Raw streams and trajectory evidence remain excluded
from the package and repository by default and are documented as potentially
sensitive diagnostic data, not conformance scoring.
