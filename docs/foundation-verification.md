# User-centered foundation verification

Date: 2026-09-18

This record covers the implementation of `foundation-v1`. All commands ran
offline with local fake executables. No live ACC, Codex, Claude Code, model, or
provider call was made.

## Phase gates

| Phase | Local gate | Independent subagent gate |
| --- | --- | --- |
| 1 — case semantics | Build plus case/schema/profile and grader tests: 14 passed, 0 failed. | Passed the same 14 tests plus 43 rejection and behavior assertions. Confirmed strict version 1 parsing, version 2 semantics, profile rejection, and bounded new checks. |
| 2 — six-case foundation | Build plus case, grader, fixture, and complete-set tests: 17 passed, 0 failed. | The first review found three material oracle weaknesses. After correction, 17 tests and five adversarial probes passed. Comments-only evidence and deletion of legacy tests were rejected; mutation targets were restored byte-for-byte; all probe fixtures were removed. |
| 3 — executable profiles | Build plus scoring, runner, and CLI tests: 14 passed, 0 failed. | Passed the same 14 tests and a separate 18-trial foundation run. Confirmed order, repeats, metadata, time cap, quality totals, completeness, all verdict paths, CLI conflicts, and version 1 ad hoc execution. |
| 4 — packaged product | Full offline gate: 48 passed, 0 failed. Installed-package test: 1 passed, 0 failed. | Passed an independent fresh pack/install and all four fake-executable runs. Confirmed 75 package entries, trial counts 3 and 18, ordered profiles, quality totals, every verdict path, cleanup, documentation, and repository scope. |

## Contract evidence

- Version 1 cases retain exact legacy fields and check kinds. They run ad hoc
  with `null` semantic fields and cannot join a profile.
- Version 2 rejects unknown fields, uncontrolled metadata, duplicate qualities,
  unsafe paths, malformed checks, and invalid regular expressions.
- The exact sorted inventory is `add-regression-coverage`,
  `already-correct-no-op`, `create-to-spec`, `fix-failing-test`,
  `follow-repository-instructions`, and `preserve-user-wip`.
- `smoke-v1` runs `create-to-spec`, `already-correct-no-op`, and
  `preserve-user-wip` once, in that order.
- `foundation-v1` runs `create-to-spec`, `fix-failing-test`,
  `preserve-user-wip`, `already-correct-no-op`,
  `follow-repository-instructions`, and `add-regression-coverage` three times,
  in that order.
- Five initial workspaces are `unsolved`. `already-correct-no-op` is
  `satisfied`, solves cleanly before work, and uses an intentionally empty
  known-good overlay.
- All six known-good overlays solve every check, stay clean, and make exactly
  the declared writes. All six known-bad overlays fail solved-and-clean
  conformance.
- Instruction reuse and regression coverage use executable mutation checks.
  They reject comments-only evidence and restore the mutated target on both
  success and failure paths.
- The complete-set gate confirms workspace cleanup after every initial,
  solution, and counterexample fixture.

## Report and profile evidence

- Report schema version 2 records case level, primary and supporting qualities,
  start state, profile identity, ordered case IDs, repeats, optional time cap,
  per-case completeness, and aggregation by primary quality.
- A complete passing profile reports `met`. Complete usable failures report
  `not_met`. Missing, duplicate, extra, or error trials report `incomplete`.
- The installed foundation run produced 18 passing trials and zero errors.
  Quality totals were 6 for `task-effectiveness` and 3 each for
  `user-work-protection`, `judgment-autonomy`, `instruction-adherence`, and
  `verification-quality`.
- Ad hoc runs retain pass, solve, clean, and error evidence but have a `null`
  profile and verdict.

## Package evidence

- Sequential `npm pack --dry-run --json` reported 75 entries, including
  `suite.json`, the suite design record, and every workspace, solution, and
  counterexample tree for all six cases.
- The dry run contained no harness test build output, plans, results,
  credentials, `.env` data, source tree, tarballs, or private local paths.
- A fresh tarball was installed offline into a temporary consumer directory.
  The installed public `agent-eval` bin ran `smoke-v1` for 3 trials and
  `foundation-v1` for 18 trials with `met` verdicts.
- Controlled no-edit and malformed-protocol runs produced `not_met` and
  `incomplete`, respectively.
- Every installed-package report confirmed workspace, adapter-home, and process
  cleanup. The package test removed its complete temporary directory.

## Repository and scope evidence

- Work stayed on `main` and modified only this repository.
- The sibling `coding-cli` repository was read only and remained clean before
  and after every independent gate.
- The active planning set contains only `project-goal.md`,
  `user-centered-evaluation-standard.md`, and
  `establish-user-centered-conformance-foundation.md`.
- Fixture provenance and uncovered quality gaps are recorded in
  `suites/portable/README.md`.

## Commit preparation evidence

- Exactly 48 reviewed implementation, test, suite, and documentation files were
  staged. No plan, result, environment, credential, tarball, or temporary file
  was staged.
- Changed-file and staged-content scans found no credential pattern, secret
  value, `.env` data, or private local path.
- `git diff --cached --check` passed after staging.
