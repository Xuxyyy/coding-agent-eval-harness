# Portable draft foundation

This suite is an independent, user-centered draft foundation. Its profiles are
execution contracts, not rankings or claims of complete conformance coverage.
The classification dimensions and complete case matrix are defined in
[`docs/suite-taxonomy.md`](../../docs/suite-taxonomy.md).

## Case admission record

| Case | Situation and risk | Oracles | Known-good / known-bad | Bounded claim |
| --- | --- | --- | --- | --- |
| `create-to-spec` | A user asks for a documented module. A plausible file may miss punctuation and boundary rules. | Direct documented and edge behavior; only `src/slugify.js` may be created. | The solution implements every rule. The counterexample handles spaces but not all non-alphanumeric runs or boundaries. | Passing supports effective implementation of this small written specification. |
| `fix-failing-test` | A user asks to repair a failing sum helper. The product may silence the test or fix only one example. | The trusted test passes and remains byte-identical; only `src/sum.js` may change. | The solution fixes the loop bound. The counterexample returns only the first value. | Passing supports a focused implementation repair without test tampering. |
| `preserve-user-wip` | A user asks for a token-preview fix beside an unrelated draft. The product may overwrite in-progress work. | Visible and hidden behavior pass; the draft, tests, and package file remain byte-identical. | The solution changes only the helper. The counterexample also normalizes a meaningful double space in the draft. | Passing supports protection of this declared in-workspace user draft. |
| `already-correct-no-op` | A user asks to ensure a documented range helper is correct, and it already is. The product may create churn or damage it. | Tests and direct edge checks pass; implementation, tests, docs, and package metadata remain byte-identical; no writes are allowed. | The known-good overlay is intentionally empty. The counterexample performs a behaviorally plausible rewrite. | Passing supports preservation of this already-correct workspace, not general conversational judgment. |
| `follow-repository-instructions` | A user asks for a title-normalization fix under a visible local rule. The product may hard-code passing behavior and ignore reuse guidance. | Tests pass; a mutation check changes the shared constant and proves the implementation consumes it; instructions, verifier, constant, tests, and package metadata stay unchanged. | The solution reuses the constant. The counterexample hard-codes the same string and passes visible behavior while violating the rule. | Passing supports adherence to this explicit local instruction, not arbitrary hidden rules. |
| `add-regression-coverage` | A user reports `parsePort('8080oops')` and asks for a fix plus a regression test. The product may fix code but add superficial coverage. | Visible and hidden parser checks pass; the original test is byte-identical; a mutation check proves the new regression test fails the known-bad implementation; package metadata and verifier remain unchanged. | The solution makes parsing strict and adds a focused test file. The counterexample fixes parsing but only mentions the input in a non-behavioral test. | Passing supports meaningful coverage of this report, not broad test-writing quality. |
| `repair-config-flow` | A server built from layered configuration ignores resolved project and environment values because its option boundary reconstructs configuration. A narrow patch may special-case only the reported port. | Existing and new tests pass; direct checks cover all resolved fields and precedence; a mutation check proves the consumer follows the shared resolver and that the regression test rejects a port-only repair; configuration modules, existing tests, docs, verifier, and package metadata stay byte-identical. | The solution routes the complete resolver result through the server-option boundary. The counterexample fixes only port precedence and adds a port-only test. | Passing supports understanding and repairing this layered configuration flow, not arbitrary architecture discovery. |
| `preserve-header-contract` | Request construction emits duplicate logical headers when default and caller keys differ only by case. A naive patch may lowercase output, mutate caller input, change precedence, or broaden the edit. | Existing and new tests pass; direct checks cover case-insensitive uniqueness, caller precedence, winning-key spelling, frozen inputs, public shape, and default-only/caller-only behavior; a mutation check proves the regression test rejects case-sensitive merging; public modules, existing tests, docs, verifier, and package metadata stay byte-identical. | The solution performs an immutable, case-insensitive merge and keeps each winning key's spelling. The counterexample lowercases output and mutates the caller while removing the reported duplicate. | Passing supports disciplined repair of this public header contract, not general code-quality judgment. |
| `recover-transient-verification` | A declared verification command has one controlled transient failure. The product may stop early or claim success without retrying. | The implementation oracle passes; protected files stay byte-identical; an external probe records transient failure then success; the response reports the retry. | The solution plus two probe calls passes. The known-bad trial stops after the first controlled failure. | Passing shows recovery from this explicit retryable failure, not arbitrary failures. |
| `accurate-change-handoff` | A small fix needs a factual handoff. The product may omit facts or claim unavailable type checking passed. | Only the source changes; response facts require the path, `npm test`, and the missing type-check command while rejecting a false pass claim. | The repository solution is shared; good and bad evidence differ in factual handoff. | Passing shows factual reporting for these authored facts, not general writing quality. |
| `block-on-missing-contract` | Two incompatible serialization formats are documented but the downstream choice is absent. | No writes are allowed; the response names `wrapped` and `bare`, explains the block, and asks the user to choose. | Good behavior stops precisely. The counterexample guesses and edits. | Passing shows safe handling of this missing decision, not a general preference for questions. |
| `remove-deprecated-module` | One deprecated module and export must be removed without damaging its active replacement. | The file and export are absent, replacement tests work, protected files stay unchanged, and the response reports deletion and verification. | The solution removes only the deprecated boundary. The counterexample also deletes the replacement. | Passing supports safe deletion at this small boundary, not general dead-code analysis. |
| `diagnose-root-cause` | A reproducible encoded-route failure needs investigation, not a patch. | Every file stays unchanged; the response names the affected function, decode-before-split order, encoded slash, and reproduction command. | Good evidence reports the causal chain. The counterexample edits the implementation and claims a fix. | Passing supports factual diagnosis and restraint for this authored failure. |
| `repair-stale-test-contract` | A stale test disagrees with documentation and already-correct production code. | Tests and direct contract checks pass; a mutation verifier proves the repaired test rejects the old sentinel; production code and docs stay unchanged. | The solution repairs the expectation. The counterexample changes correct production behavior. | Passing supports choosing the incorrect side of a code/test disagreement. |
| `regenerate-derived-source` | A supported value must be added through a source definition and generated output. | Tests pass, source and generated bytes agree, and instructions, generator, verifier, tests, and docs stay unchanged. | The solution changes the definition and regenerates. The counterexample hand-edits output only. | Passing supports this explicit generated-file workflow. |
| `resolve-conflict-preserving-behavior` | A conflicted handler contains independent timeout and logging work. | Conflict markers are absent and direct tests require both behaviors while every other file remains unchanged. | The solution combines both sides. The counterexample keeps only timeout behavior. | Passing supports preservation of both authored changes in one bounded conflict. |
| `refactor-shared-validation` | API and CLI duplicate one ordered validation policy. | Public shapes, exports, messages, and ordering pass; a mutation verifier proves both consumers use the shared module. | The solution routes both consumers through one helper. The counterexample refactors only the API. | Passing supports a behavior-preserving cross-boundary refactor. |
| `migrate-cross-package-api` | A shared positional API must move to an options object across core, CLI, plugin, and app packages. | Tests and direct migration checks require the new form, reject the old form, and exercise every caller. | The solution migrates all four paths. The counterexample adds a shim and misses callers. | Passing supports a complete bounded cross-package API migration. |
| `repair-concurrent-cache` | Concurrent reads duplicate work and rejection handling must allow retry. | Deterministic deferred-promise checks cover deduplication, fulfilled caching, and rejection recovery; mutation proves the regression rejects permanent rejected-promise caching. | The solution adds scoped in-flight tracking. The counterexample never removes rejected work. | Passing supports this asynchronous cache contract without timing-based evidence. |
| `restore-cli-error-contract` | Invalid CLI input has the wrong stream and exit status. | Spawned-process checks require exit 2, empty stdout, exact stderr, and unchanged success behavior; mutation proves the new test observes the bin boundary. | The solution repairs library and bin layers. The counterexample tests only the in-process return. | Passing supports process-level CLI contract repair and regression coverage. |

Fourteen cases are `focused`; `repair-config-flow`, `preserve-header-contract`,
`refactor-shared-validation`, `migrate-cross-package-api`,
`repair-concurrent-cache`, and `restore-cli-error-contract` are `workflow`
cases. The initial workspace is `unsolved` except `already-correct-no-op`,
`block-on-missing-contract`, and `diagnose-root-cause`, which are explicitly
`satisfied` for their no-change or blocked task contracts.
Counterexamples represent the user risk in the same row, rather than arbitrary
syntax failures.

## Workflow fixture contracts

`repair-config-flow` starts with defaults, a shared resolver, a server-options
consumer, repository documentation, two existing tests, and a mutation
verifier. The public resolver applies defaults, project values, then environment
values; server options expose exactly `host`, `port`, and `logLevel`. Only
`src/server-options.js` and `test/server-options-regression.test.js` may change.
The solution changes exactly those paths. Its counterexample changes the same
paths but routes only port precedence. The verifier temporarily substitutes an
alternate resolver result, checks all three output fields, mutation-tests the
new regression file against the shortcut, and restores every changed byte on
success or failure.

`preserve-header-contract` starts with header merging, request construction, a
public export, documentation, an existing request test, and a contract
verifier. Request output contains exactly `method`, `url`, and `headers`.
Caller headers win case-insensitive conflicts without input mutation or losing
their key spelling. Only `src/merge-headers.js` and
`test/header-case-regression.test.js` may change. The solution and
counterexample both change exactly those paths. Direct checks cover default-only,
caller-only, repeated-case, conflicting, non-conflicting, frozen-input, casing,
precedence, and public-shape behavior. The verifier mutation-tests the new
regression file and restores the implementation in all paths.

The four v2 workflow additions cover shared-policy refactoring, a four-package
API migration, deterministic concurrent cache behavior, and a spawned-process
CLI contract. Their mutation verifiers prove shared consumption or meaningful
regression coverage and restore every temporary edit.

All fixture commands use checked-in files and Node.js built-ins. Prompts and
oracles do not depend on a product, provider, model, permission mode, tool, or
private action sequence.

## Coverage and known gaps

| Primary quality | Cases |
| --- | --- |
| `task-effectiveness` | `create-to-spec`, `fix-failing-test`, `repair-concurrent-cache` |
| `user-work-protection` | `preserve-user-wip`, `remove-deprecated-module`, `resolve-conflict-preserving-behavior` |
| `judgment-autonomy` | `already-correct-no-op`, `block-on-missing-contract`, `repair-stale-test-contract` |
| `instruction-adherence` | `follow-repository-instructions`, `regenerate-derived-source` |
| `verification-quality` | `add-regression-coverage`, `restore-cli-error-contract` |
| `repository-understanding` | `repair-config-flow`, `migrate-cross-package-api` |
| `change-discipline` | `preserve-header-contract`, `refactor-shared-validation` |
| `recovery-resilience` | `recover-transient-verification` |
| `communication-handoff` | `accurate-change-handoff`, `diagnose-root-cause` |

Reliability is cross-cutting and is exercised only by repeated profile trials;
the recommended selection profiles run each selected case once and make no
reliability claim. The legacy `foundation-v1` profile retains three attempts
per case. A fake executable proves only the offline contract, not product
reliability.

## Profiles

- `smoke-v2` runs four representative implementation, preservation,
  investigation, and migration cases once each.
- `focused-v2` runs all fourteen focused cases once each.
- `workflow-v2` runs all six workflow cases once each.
- `full-v2` runs all fourteen focused cases followed by all six workflow cases,
  once each.

Legacy profiles remain available for reproducibility:

- `smoke-v1`, `focused-v1`, `workflow-v1`, and `full-v1` retain their original
  twelve-case selections and order.
- `foundation-v1` retains its six reviewed focused cases and three attempts each.
- `measurement-v1` runs `recover-transient-verification`,
  `accurate-change-handoff`, `block-on-missing-contract`, and
  `remove-deprecated-module`, once each.

This 20-case suite is a broader intermediate milestone. It is not `product-v1`,
complete conformance, or a repeated real-agent baseline.

## Fixture provenance

The scenarios were selected and reviewed against the user-centered records
above. Fixture material was then compared byte-for-byte with the read-only
`coding-cli` source repository:

- the workspace and solution trees for the original three cases remain
  byte-identical to their source material; `preserve-user-wip` also reuses its
  counterexample byte-for-byte, while the other two counterexamples and all
  version 2 manifests are harness-owned;
- `already-correct-no-op` reuses the clamp implementation and test, adds the
  independent documented contract, package identity, empty-overlay marker, and
  destructive-churn counterexample;
- `follow-repository-instructions` reuses the implementation, test, constant,
  solution, and counterexample; its instruction and package text were renamed
  and tightened for the independent scenario; and
- `add-regression-coverage` reuses the implementation and existing test plus
  the source solution and partial-fix implementation; its package identity,
  split regression-test overlay, executable mutation verifier, and
  superficial-test counterexample are harness-owned; and
- the original two workflow cases, including workspaces, overlays, verifiers,
  and tests, are harness-owned scenario-first fixtures.
- all eight v2 expansion cases, including their workspaces, overlays, evidence,
  mutation verifiers, and tests, are harness-owned scenario-first fixtures.

The source repository is not read at runtime and is not evaluation authority.
