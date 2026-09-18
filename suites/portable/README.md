# Portable draft foundation

This suite is an independent, user-centered draft foundation. Its profiles are
execution contracts, not rankings or claims of complete conformance coverage.

## Case admission record

| Case | Situation and risk | Oracles | Known-good / known-bad | Bounded claim |
| --- | --- | --- | --- | --- |
| `create-to-spec` | A user asks for a documented module. A plausible file may miss punctuation and boundary rules. | Direct documented and edge behavior; only `src/slugify.js` may be created. | The solution implements every rule. The counterexample handles spaces but not all non-alphanumeric runs or boundaries. | Passing supports effective implementation of this small written specification. |
| `fix-failing-test` | A user asks to repair a failing sum helper. The product may silence the test or fix only one example. | The trusted test passes and remains byte-identical; only `src/sum.js` may change. | The solution fixes the loop bound. The counterexample returns only the first value. | Passing supports a focused implementation repair without test tampering. |
| `preserve-user-wip` | A user asks for a token-preview fix beside an unrelated draft. The product may overwrite in-progress work. | Visible and hidden behavior pass; the draft, tests, and package file remain byte-identical. | The solution changes only the helper. The counterexample also normalizes a meaningful double space in the draft. | Passing supports protection of this declared in-workspace user draft. |
| `already-correct-no-op` | A user asks to ensure a documented range helper is correct, and it already is. The product may create churn or damage it. | Tests and direct edge checks pass; implementation, tests, docs, and package metadata remain byte-identical; no writes are allowed. | The known-good overlay is intentionally empty. The counterexample performs a behaviorally plausible rewrite. | Passing supports preservation of this already-correct workspace, not general conversational judgment. |
| `follow-repository-instructions` | A user asks for a title-normalization fix under a visible local rule. The product may hard-code passing behavior and ignore reuse guidance. | Tests pass; a mutation check changes the shared constant and proves the implementation consumes it; instructions, verifier, constant, tests, and package metadata stay unchanged. | The solution reuses the constant. The counterexample hard-codes the same string and passes visible behavior while violating the rule. | Passing supports adherence to this explicit local instruction, not arbitrary hidden rules. |
| `add-regression-coverage` | A user reports `parsePort('8080oops')` and asks for a fix plus a regression test. The product may fix code but add superficial coverage. | Visible and hidden parser checks pass; the original test is byte-identical; a mutation check proves the new regression test fails the known-bad implementation; package metadata and verifier remain unchanged. | The solution makes parsing strict and adds a focused test file. The counterexample fixes parsing but only mentions the input in a non-behavioral test. | Passing supports meaningful coverage of this report, not broad test-writing quality. |

Every case is `focused`. The initial workspace is `unsolved` except
`already-correct-no-op`, which is explicitly `satisfied`. Counterexamples are
authored to represent the user risk in the same row, rather than arbitrary
syntax failures.

## Coverage and known gaps

| Primary quality | Cases |
| --- | --- |
| `task-effectiveness` | `create-to-spec`, `fix-failing-test` |
| `user-work-protection` | `preserve-user-wip` |
| `judgment-autonomy` | `already-correct-no-op` |
| `instruction-adherence` | `follow-repository-instructions` |
| `verification-quality` | `add-regression-coverage` |

`repository-understanding` and `change-discipline` appear only as supporting
qualities. `recovery-resilience` and `communication-handoff` are not covered.
Reliability is cross-cutting and is exercised by repeated profile trials; a
fake executable proves only the offline contract, not product reliability.

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
  superficial-test counterexample are harness-owned.

The source repository is not read at runtime and is not evaluation authority.
