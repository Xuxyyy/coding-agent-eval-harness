# Two-dimensional portable suite taxonomy

The portable suite separates expected difficulty from capability type. These
are independent dimensions and can be selected alone or together.

## Selection model

```text
portable suite (25)
  |-- tier: baseline (13) | challenge (12)
  `-- module: reasoning | execution | recovery | verification

selection = optional tier filter AND optional module filter
```

With no filters, all 25 cases run. A single filter selects all matching cases.
Two filters select their intersection. Every built-in intersection is nonempty.

| Tier | Meaning |
| --- | --- |
| `baseline` | Core behavior a coding agent is expected to pass. |
| `challenge` | Harder work used to expose limits and diagnose failure causes. |

| Module | Question |
| --- | --- |
| `reasoning` | Did the agent understand the active path, repository contract, and correct action? |
| `execution` | Did it implement the change completely and with safe scope? |
| `recovery` | Did it respond correctly to tool failure or partially completed work? |
| `verification` | Did it collect enough evidence and report only supported facts? |

## Case matrix

| Tier | Module | Cases |
| --- | --- | --- |
| baseline | reasoning | `already-correct-no-op`, `block-on-missing-contract`, `diagnose-root-cause` |
| baseline | execution | `create-to-spec`, `fix-failing-test`, `preserve-user-wip`, `follow-repository-instructions`, `remove-deprecated-module`, `resolve-conflict-preserving-behavior` |
| baseline | recovery | `recover-transient-verification`, `fallback-after-tool-failure` |
| baseline | verification | `add-regression-coverage`, `accurate-change-handoff` |
| challenge | reasoning | `repair-stale-test-contract`, `trace-actual-runtime-path`, `repair-config-flow`, `migrate-cross-package-api` |
| challenge | execution | `regenerate-derived-source`, `preserve-header-contract`, `refactor-shared-validation`, `repair-concurrent-cache`, `add-timeout-option-workflow` |
| challenge | recovery | `resume-partial-migration` |
| challenge | verification | `restore-cli-error-contract`, `verify-cross-layer-fix` |

The suite manifest fixes stable order. It lists the 13 baseline cases first,
then the 12 challenge cases, using the row order above.

## Other case metadata

Tier and module do not replace the existing diagnostic dimensions:

- `level`: `focused` or `workflow`, describing fixture shape.
- `horizon`: `short`, `multi-stage`, or `long-horizon`, describing the
  dependency chain inside one CLI run.
- `primaryQuality` and supporting qualities: the detailed skills measured.
- `expectedDisposition`: `implemented`, `no-change`, or `blocked`.
- safety: exact write scopes and unchanged checks across every case.

## Boundaries

This classification changes only metadata and selection. The 25 prompts,
fixtures, solutions, counterexamples, evidence files, and graders are unchanged.
The suite does not yet cover cross-session restore, conversation restore, or
MCP behavior. `long-horizon` means connected work within one CLI run.

## Admission rules

A new portable case must:

1. Declare exactly one tier, one primary module, one level, and one horizon.
2. Include workspace, solution, plausible counterexample, known-good evidence,
   and known-bad evidence.
3. Pass initial-workspace, solution, counterexample, and evidence admission.
4. Use exact allowed writes and protect unrelated repository material.
5. Grade observable facts rather than product-specific tool names or counts.
6. Appear exactly once in the ordered suite manifest.
