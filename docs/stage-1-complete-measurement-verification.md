# Stage 1 complete measurement verification

Verified on 2026-09-19 on `main`, based on
`defdbef61aa39e60a5342c3f14287c950d1db633`.

This record covers the 12-case deterministic measurement boundary, case schema
version 3, report schema version 4, artifact schema version 2, separate
repository-outcome and trial-behavior grades, controlled recovery evidence, and
patch capture anchored to the original fixture commit. It does not claim a
real-agent reliability result.

## Gate summary

| Gate | Result |
| --- | --- |
| Pre-change baseline | 69 passed, 0 failed |
| Planned focused command | 35 passed, 0 failed; exit 0 |
| Complete offline gate | 85 passed, 0 failed, 0 skipped, 0 cancelled; exit 0 |
| Dry package gate | 176 entries; 59,514 packed bytes; 233,632 unpacked bytes; exit 0 |
| Independent installed-package E2E | Four ordered trials passed; profile `met`; exit 0 |
| CLI help | Report JSONL versions 2, 3, and 4 documented; exit 0 |

The focused command was the exact nine-file command from the execution plan. It
covered schema parsing, behavior grading, control isolation, evaluation,
artifacts, and all four new case test files. The complete gate was:

```text
env npm_config_cache=/tmp/agent-eval-harness-npm-cache npm test
```

## Case admission evidence

The complete portable-set admission test exercised all 12 cases. Each reviewed
solution and valid variation passed. Each initial state and case-specific
counterexample produced the expected non-pass result.

| Case | Initial-state check | Reviewed solution | Counterexample and adversarial checks |
| --- | --- | --- | --- |
| `create-to-spec` | Passed | Passed | Rejected |
| `fix-failing-test` | Passed | Passed | Rejected |
| `preserve-user-wip` | Passed | Passed | Rejected |
| `already-correct-no-op` | Passed | Passed | Rejected |
| `follow-repository-instructions` | Passed | Passed | Rejected |
| `add-regression-coverage` | Passed | Passed | Rejected |
| `repair-config-flow` | Passed | Passed | Rejected |
| `preserve-header-contract` | Passed | Passed | Rejected |
| `recover-transient-verification` | Passed | Passed | Skipped retry and protected-test tampering rejected |
| `accurate-change-handoff` | Passed | Passed | False, incomplete, and comments-only handoffs rejected |
| `block-on-missing-contract` | Passed | Passed | Both unsupported guesses and every workspace write rejected |
| `remove-deprecated-module` | Passed | Passed | Dangling export, broad deletion, compatibility shim, and unrelated churn rejected |

The four new cases also checked exact writes, protected files, known-good and
known-bad behavior fixtures, equivalent valid wording or implementation, and
out-of-scope changes. The suite covers the `implemented`, `no-change`, and
`blocked` dispositions. Classification tests cover pass, capability failure,
and harness error, with a pass requiring both repository and behavior grades.

## Compatibility and evidence contracts

- Case schemas 1, 2, and 3 load through the supported paths. Conformance
  profiles still reject schema 1 cases.
- Report schemas 2, 3, and 4 remain readable.
- Artifact schemas 1 and 2 remain readable, including report schema 3 with an
  artifact schema 1 manifest.
- The original eight case directories are byte-unchanged in the Git diff.
- `smoke-v1`, `foundation-v1`, and `workflow-v1` retain their exact case order
  and repeat counts. `measurement-v1` is the only added profile.
- Behavior checks accept valid phrasing variation, require ordered recovery
  outcomes, allow extra benign events, and enforce blocked terminal semantics.
- Trial-control tests proved per-trial isolation, harness-owned external event
  storage, malformed and forged record rejection, and cleanup on success and
  failure.
- Patch tests covered added, modified, deleted, staged, unstaged, committed,
  binary, and truncated evidence. Capture remained anchored to the original
  fixture commit without changing the real branch, `HEAD`, or index, and its
  temporary index was removed on success and failure.

## Package evidence

The final dry pack reported `agent-eval-harness@0.1.0`, 176 entries, and SHA-1
`02f40dc3453b511adb347a7e81d6d4b45d9b53d4`. The package included all 12 case
manifests and required fixture trees, the four version 3 evidence directories,
the portable-suite documentation, and the new runtime modules. It excluded
plans, tests, source TypeScript, results, credentials, `.env*` files, tarballs,
control logs, and temporary evidence.

## Independent installed-package E2E

A general subagent acted as an independent black-box verifier. It rebuilt the
latest source, packed it into a fresh temporary root, installed the local
tarball offline into a fresh consumer, and used only the installed public CLI.
Sanitized commands were:

```text
npm run build
env npm_config_cache=<temp>/npm-cache npm pack --json --pack-destination <temp>
env npm_config_cache=<temp>/npm-cache npm install --offline --ignore-scripts --no-audit --no-fund <temp>/agent-eval-harness-0.1.0.tgz
./node_modules/.bin/agent-eval run --agent acc --command <temp>/consumer/fake-acc --cases ./node_modules/agent-eval-harness/suites/portable --profile measurement-v1 --output <temp>/result.jsonl
./node_modules/.bin/agent-eval inspect --result <temp>/result.jsonl --case recover-transient-verification --repeat 1
./node_modules/.bin/agent-eval inspect --result <temp>/result.jsonl --case remove-deprecated-module --repeat 1
```

Every command exited 0. The installed package was version `0.1.0`; the public
fake ACC protocol version was 2.0. The trials passed in this order:

1. `recover-transient-verification` — `implemented`
2. `accurate-change-handoff` — `implemented`
3. `block-on-missing-contract` — `blocked`
4. `remove-deprecated-module` — `implemented`

All repository grades and behavior grades passed, and the profile verdict was
`met`. Recovery inspection showed `transient-failure` followed by `passed`.
Deletion inspection showed the complete removal of
`src/deprecated-format.js` and its export even though the fake agent committed
the change. The result used report schema 4 and artifact schema 2. Every
artifact manifest and referenced file was readable. Workspace, adapter-home,
process, and control cleanup were true for every trial and for the report.

The verifier removed the temporary consumer, tarball, npm cache, result,
artifacts, fixture roots, Git-index roots, adapter homes, fake executable, and
control state. It made no source, test, documentation, or plan edit. The run
made no network, model, provider, account, or paid API call. Its cost was $0.

## Documentation, privacy, and final hygiene

- README, suite documentation, package inventory tests, and CLI help agree on
  12 cases, `measurement-v1`, separated grades, schema compatibility, control
  evidence, and original-commit patch capture.
- Documentation calls this an intermediate measurement milestone, not
  `product-v1`, complete certification, or a live baseline.
- The active ignored planning files were updated as required. Historical
  completed verification records were retained unchanged.
- No `.claude/` file or unrelated tracked file was changed.
- Changed and untracked file inspection found no credential, access token,
  private key, `.env` data, raw transcript, result bundle, tarball, control log,
  or private absolute path.
- `git diff --check` passed. No file is staged, committed, or pushed.
- Generated `dist/`, `.test-dist/`, and the task-owned temporary compile root
  were removed after the package checks. The independent E2E temporary root was
  also removed. An older ignored `results/` tree and an older temporary fixture
  that predated this run were left unchanged.

The remaining gate is user review of the complete Stage 1 diff. No real coding
agent or provider was tested, so provider compatibility and real-agent
reliability remain outside this milestone.
