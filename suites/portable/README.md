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

Ten cases are `focused`; `repair-config-flow` and `preserve-header-contract`
are `workflow` cases. The initial workspace is
`unsolved` except `already-correct-no-op`, which is explicitly `satisfied`.
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

All fixture commands use checked-in files and Node.js built-ins. Prompts and
oracles do not depend on a product, provider, model, permission mode, tool, or
private action sequence.

## Coverage and known gaps

| Primary quality | Cases |
| --- | --- |
| `task-effectiveness` | `create-to-spec`, `fix-failing-test` |
| `user-work-protection` | `preserve-user-wip` |
| `judgment-autonomy` | `already-correct-no-op` |
| `instruction-adherence` | `follow-repository-instructions` |
| `verification-quality` | `add-regression-coverage` |
| `repository-understanding` | `repair-config-flow` |
| `change-discipline` | `preserve-header-contract` |
| `recovery-resilience` | `recover-transient-verification` |
| `communication-handoff` | `accurate-change-handoff` |

Reliability is cross-cutting and is exercised only by repeated profile trials;
the recommended selection profiles run each selected case once and make no
reliability claim. The legacy `foundation-v1` profile retains three attempts
per case. A fake executable proves only the offline contract, not product
reliability.

## Profiles

- `smoke-v1` retains its three reviewed cases and one attempt each.
- `focused-v1` runs all ten focused cases once each.
- `workflow-v1` runs `repair-config-flow` followed by
  `preserve-header-contract`, once each.
- `full-v1` runs all ten focused cases followed by both workflow cases, once
  each.

Legacy profiles remain available for reproducibility:

- `foundation-v1` retains its six reviewed focused cases and three attempts each.
- `measurement-v1` runs `recover-transient-verification`,
  `accurate-change-handoff`, `block-on-missing-contract`, and
  `remove-deprecated-module`, once each.

This 12-case suite is an intermediate milestone. It is not `product-v1`,
complete conformance, or a real-agent baseline.

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
- both workflow cases, including workspaces, overlays, verifiers, and tests,
  are harness-owned scenario-first fixtures.

The source repository is not read at runtime and is not evaluation authority.
