# Portable suite v2 verification

Verified on 2026-09-20 with agent-eval-harness 0.1.0, Node.js v22.18.0,
ACC 0.1.0, and requested model `deepseek-v4-flash`.

This record covers the 20-case portable catalog, the four v2 selection
profiles, deterministic admission of eight new schema-version-3 cases, packed
installed-CLI execution, and a one-trial ACC pilot for each new case. It is not
a reliability baseline or a claim of complete coding-agent coverage.

## Offline gates

| Gate | Result |
| --- | --- |
| Complete test suite | 88 passed, 0 failed, 0 skipped or cancelled |
| New-case admission | Initial states, reviewed solutions, known-bad counterexamples, behavior evidence, and adversarial probes passed for all eight cases |
| Installed package | `smoke-v2`, `focused-v2`, `workflow-v2`, and `full-v2` passed through the installed public CLI with the fake ACC executable |
| Dry package | 299 entries; 76,088 packed bytes; 289,606 unpacked bytes |
| Diff hygiene | The staged diff check passed after excluding the intentional conflict-marker input fixture |

The package inventory included all 20 manifests and their required workspace,
solution, counterexample, and evidence trees. It excluded source TypeScript,
tests, results, credentials, `.env` files, tarballs, and temporary control
evidence.

One final gate initially exposed a cross-process race in the existing Git
evidence test: it inspected a shared temporary-directory prefix while package
tests were creating and deleting directories with the same prefix. The test
now uses and restores an isolated `TMPDIR`. The complete suite then passed with
all 88 tests green.

The current `full-v2` suite content hash is
`edd8dd2edbaae66ea9fb635d2e10c57ee2109d14cb8c9a0f650b4cd911b3405f`.
The current eight-case expansion hash is
`d4036353bbd32454cb07288f3a0548dd5054954a22b47f1ebb5ba01a5a4f2775`.

## ACC pilot

The final pilot is a reviewed composition: seven unchanged cases retain their
first trials, and `diagnose-root-cause` uses the final rerun after its response
oracle was corrected. Every retained trial passed repository and behavior
grading, remained clean, completed normally, preserved its artifact bundle,
and reported complete workspace, adapter-home, process, and control cleanup.

| Case | Result | Elapsed ms | Total tokens |
| --- | --- | ---: | ---: |
| `diagnose-root-cause` | pass | 6,536 | 7,617 |
| `migrate-cross-package-api` | pass | 13,411 | 30,539 |
| `refactor-shared-validation` | pass | 11,315 | 19,420 |
| `regenerate-derived-source` | pass | 5,764 | 13,520 |
| `repair-concurrent-cache` | pass | 44,278 | 114,640 |
| `repair-stale-test-contract` | pass | 5,150 | 10,222 |
| `resolve-conflict-preserving-behavior` | pass | 6,885 | 11,401 |
| `restore-cli-error-contract` | pass | 19,530 | 41,828 |
| **Composed total** | **8/8 pass** | **112,869** | **249,187** |

The live work used ten ACC executions: the initial eight-case run and two
diagnosis-only reruns. Observable usage across all ten executions, including
the two replaced diagnosis trials, was 267,411 tokens. Using the repository's
dated DeepSeek V4.1 Flash baseline as the cost basis gives an approximate
range of **$0.015–$0.052**. This is an estimate, not provider billing; current
routing and cache charges were not independently verified.

## Pilot correction

The initial diagnosis trial correctly identified the decode-before-split root
cause, ran `npm test`, and made no repository change. Its response said “No
repository changes were made,” while the authored regular expression accepted
only “No changes were made” or “No files were changed.” The first correction
accepted the repository-qualified form. A rerun then used “No files were
modified,” exposing the same overly narrow verb choice. The final rule accepts
common factual forms using `changed`, `modified`, or `edited`, and focused tests
cover all three forms plus a symptom-only rejection.

No outcome oracle or protection rule was weakened. The final diagnosis rerun
passed with an empty patch and all cleanup flags true. Raw JSONL, stdout,
events, and patches remain in the ignored local results area and are not part
of this record.

## Remaining limits

- The suite still uses Node.js fixtures only.
- One trial per new case proves public-boundary usability, not reliability.
- `recovery-resilience` still has only one primary case.
- The suite remains an intermediate portable standard, not `product-v1`, a
  leaderboard, or complete certification.
