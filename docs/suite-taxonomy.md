# Four-module portable suite taxonomy

The portable suite is organized from an agent-builder's point of view. A user
can run the module they are diagnosing instead of selecting cases by fixture
size.

## Selection model

```text
portable suite
  |-- reasoning-v1
  |-- execution-v1
  |-- recovery-v1
  |-- verification-v1
  `-- full-agent-v1 = all four modules in that order
```

Each case belongs to exactly one primary module:

| Module | Question |
| --- | --- |
| `reasoning` | Did the agent understand the active path, repository contract, and correct action? |
| `execution` | Did it implement the change completely and with safe scope? |
| `recovery` | Did it respond correctly to tool failure or partially completed work? |
| `verification` | Did it collect enough evidence and report only supported facts? |

The profile tells the harness what to run. It is not a score dimension. All
five profiles use one trial per case and make no reliability claim.

| Profile | Module | Cases | Repeats |
| --- | --- | ---: | ---: |
| `reasoning-v1` | reasoning | 7 | 1 |
| `execution-v1` | execution | 11 | 1 |
| `recovery-v1` | recovery | 3 | 1 |
| `verification-v1` | verification | 4 | 1 |
| `full-agent-v1` | all | 25 | 1 |

Old bundled profile IDs are removed. Historical result schemas remain
inspectable, but old IDs are not accepted as aliases for current runs.

## Separate dimensions

Module, level, horizon, quality, disposition, and safety answer different
questions. They must not be collapsed into one taxonomy.

- `level` describes case shape. `focused` isolates a narrow situation.
  `workflow` crosses connected repository boundaries.
- `horizon` describes the dependency chain within one CLI run. Values are
  `short`, `multi-stage`, and `long-horizon`.
- `primaryQuality` identifies the main detailed skill being measured.
  Supporting qualities may overlap modules.
- `expectedDisposition` is `implemented`, `no-change`, or `blocked`.
- safety is cross-cutting. Exact write scopes and unchanged checks protect user
  work, instructions, tests, generators, metadata, and unrelated files.

`focused` and `workflow` therefore remain case metadata. They are not selectable
bundled profiles.

## Current case matrix

| Module | Case | Level | Horizon | Primary quality | Disposition |
| --- | --- | --- | --- | --- | --- |
| reasoning | `already-correct-no-op` | focused | short | judgment-autonomy | no-change |
| reasoning | `block-on-missing-contract` | focused | short | judgment-autonomy | blocked |
| reasoning | `diagnose-root-cause` | focused | short | communication-handoff | no-change |
| reasoning | `repair-stale-test-contract` | focused | short | judgment-autonomy | implemented |
| reasoning | `trace-actual-runtime-path` | workflow | multi-stage | repository-understanding | implemented |
| reasoning | `repair-config-flow` | workflow | multi-stage | repository-understanding | implemented |
| reasoning | `migrate-cross-package-api` | workflow | multi-stage | repository-understanding | implemented |
| execution | `create-to-spec` | focused | short | task-effectiveness | implemented |
| execution | `fix-failing-test` | focused | short | task-effectiveness | implemented |
| execution | `preserve-user-wip` | focused | short | user-work-protection | implemented |
| execution | `follow-repository-instructions` | focused | short | instruction-adherence | implemented |
| execution | `remove-deprecated-module` | focused | short | user-work-protection | implemented |
| execution | `resolve-conflict-preserving-behavior` | focused | short | user-work-protection | implemented |
| execution | `regenerate-derived-source` | focused | multi-stage | instruction-adherence | implemented |
| execution | `preserve-header-contract` | workflow | multi-stage | change-discipline | implemented |
| execution | `refactor-shared-validation` | workflow | multi-stage | change-discipline | implemented |
| execution | `repair-concurrent-cache` | workflow | multi-stage | task-effectiveness | implemented |
| execution | `add-timeout-option-workflow` | workflow | long-horizon | task-effectiveness | implemented |
| recovery | `recover-transient-verification` | focused | short | recovery-resilience | implemented |
| recovery | `fallback-after-tool-failure` | focused | multi-stage | recovery-resilience | implemented |
| recovery | `resume-partial-migration` | workflow | multi-stage | recovery-resilience | implemented |
| verification | `add-regression-coverage` | focused | short | verification-quality | implemented |
| verification | `accurate-change-handoff` | focused | short | communication-handoff | implemented |
| verification | `restore-cli-error-contract` | workflow | multi-stage | verification-quality | implemented |
| verification | `verify-cross-layer-fix` | workflow | multi-stage | verification-quality | implemented |

Profile order is stable. Within a module, cases move from lower dependency
complexity to higher dependency complexity.

## Admission rules

A new portable case must:

1. Declare exactly one primary module, one level, and one horizon.
2. Include workspace, solution, plausible counterexample, known-good evidence,
   and known-bad evidence.
3. Pass initial-workspace, solution, counterexample, and evidence admission.
4. Use exact allowed writes and protect unrelated repository material.
5. Grade tool use through facts, changes, and verification evidence rather than
   a product-specific tool name or call count.
6. Join exactly one module profile and appear exactly once in the full profile.

Long-horizon currently means a substantial dependency chain inside one public
CLI run. Cross-session pause and resume are outside this version.
