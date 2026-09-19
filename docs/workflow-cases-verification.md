# Workflow cases verification

Verified on 2026-09-19 for branch `codex/add-workflow-cases`.

## Milestone identity

- The portable suite contains exactly eight version 2 cases: six `focused`
  cases and two `workflow` cases.
- `repair-config-flow` provides primary `repository-understanding` evidence.
- `preserve-header-contract` provides primary `change-discipline` evidence.
- `workflow-v1` selects those cases in that order with one attempt each.
- `smoke-v1` and `foundation-v1` retain their prior membership, order, and
  repeat counts.
- This is an intermediate eight-case milestone. It is not `product-v1` and
  makes no workflow reliability claim. `recovery-resilience` and
  `communication-handoff` remain uncovered primary qualities.

## Scenario and oracle evidence

| Case | Initial state | Reviewed solution | Counterexample and adversarial evidence |
| --- | --- | --- | --- |
| `repair-config-flow` | Unsolved because server options use defaults instead of layered configuration. | Passed every outcome and protection check while changing exactly `src/server-options.js` and `test/server-options-regression.test.js`. An alternate implementation that aliases and spreads the shared resolver result also passed. | The port-only repair failed the alternate-resolver and regression-mutation checks. Comments-only, hard-coded, existing-test tampering, documentation rewrite, deleted-test, and out-of-scope probes all failed solved-and-clean conformance. Resolver and consumer mutations were byte-restored on success and failure paths. |
| `preserve-header-contract` | Unsolved because object spread emits duplicate logical headers with case variants. | Passed every outcome and protection check while changing exactly `src/merge-headers.js` and `test/header-case-regression.test.js`. An alternate immutable merge also passed. | The lowercase-and-mutate shortcut failed casing, immutability, and contract checks. Comments-only, lowercase normalization, caller mutation, existing-test tampering, public-boundary rewrite, deleted-test, and out-of-scope probes all failed solved-and-clean conformance. |

The header contract checks default-only, caller-only, conflicting,
non-conflicting, repeated-case, frozen-input, winning-key casing, caller
precedence, case-insensitive uniqueness, and public-shape behavior. The
configuration contract checks precedence, all resolved fields, alternate
resolver results, the public server-option shape, and meaningful regression
coverage. Fixture commands use only checked-in files and Node.js built-ins.

## Automated gates

- Focused workflow compilation and tests: 6 passed, 0 failed.
- Integrated suite, CLI, and installed-package tests: 20 tests exercised; the
  19 non-packaging tests passed in the sandbox, and the packaging test passed
  when rerun with the required local npm-cache access.
- Complete `npm test`: 69 passed, 0 failed, 0 skipped, 0 cancelled.
- `npm pack --dry-run --json`: passed with 132 entries, 47,803 packed bytes,
  and 186,081 unpacked bytes.
- Package inventory included every new manifest, workspace file, solution file,
  counterexample file, suite document, and runtime module. It excluded plans,
  sources, tests, results, credentials, `.env*`, tarballs, and temporary
  evidence.
- Built-CLI tests passed all eight ad hoc cases and `workflow-v1`. Existing
  no-edit and malformed modes remained capability-failure and evidence-error
  paths rather than false passes.

No live ACC, Codex, Claude, model, provider, paid API, production service, or
network call was used by any verification gate.

## Independent installed-CLI gate

A general subagent acted as an independent black-box verifier and did not edit
the repository. It copied the current project to a fresh temporary source,
built and packed it, installed the local tarball into a fresh consumer with
offline mode, and used only the installed `agent-eval` executable. Because the
default npm cache was not writable in its sandbox, it used a cache inside its
temporary root.

Sanitized setup commands were:

```sh
npm run build
npm --cache "$TMP_ROOT/npm-cache" pack --pack-destination "$TMP_ROOT/package"
npm --cache "$TMP_ROOT/npm-cache" init -y
npm --cache "$TMP_ROOT/npm-cache" install --offline --ignore-scripts --no-audit --no-fund "$TARBALL"
```

The verifier created an independent public ACC-compatible fake executable in
the temporary root. It detected each workflow through workspace files only and
emitted public JSONL. The positive command was equivalent to:

```sh
FAKE_ACC_BEHAVIOR=solve ./node_modules/.bin/agent-eval run \
  --agent acc \
  --command "$TMP_ROOT/fake-acc.mjs" \
  --cases ./node_modules/agent-eval-harness/suites/portable \
  --profile workflow-v1 \
  --output "$TMP_ROOT/evidence/workflow.jsonl"
```

The installed run exited 0. It produced exactly two ordered passing trials,
both solved and clean, and a `met` verdict. Primary-quality aggregation was
`repository-understanding` 1/1 and `change-discipline` 1/1. The installed
`inspect` command selected `repair-config-flow` repeat 1 and showed the exact
allowed changes, all 11 checks passing, no scope violations, and workspace,
adapter-home, and process cleanup all true.

For both cases, the verifier inspected `manifest.json`, `stdout.bin`,
`stderr.bin`, `events.jsonl`, and `final.patch`. Every referenced file existed;
recorded byte sizes and SHA-256 values matched; no artifact was truncated. The
patches contained only each case's two allowed paths and the reviewed behavior.

The same installed boundary also produced:

- `no-edit`: exit 1, two capability failures, `not_met`, complete cleanup.
- `malformed`: exit 1, two evidence errors, `incomplete`, complete cleanup.

The temporary source, consumer, npm cache, executable, tarball, reports, and
artifact bundles were removed. The independent verdict was **PASS**.

## Preservation and final hygiene

- The original six case directories were not modified.
- Production adapters, adapter protocol behavior, graders, schemas, and report
  meanings were not modified.
- The sibling repository and `.claude/` were not modified or used at runtime.
- Changed and staged inventories, sensitive-data inspection, temporary-output
  inspection, and `git diff --check` passed before commit.
- Final staged diff: 36 files changed, 998 insertions, and 35 deletions.
- The final branch contained only the reviewed implementation, suite data,
  tests, documentation, and package-script changes for this milestone.
