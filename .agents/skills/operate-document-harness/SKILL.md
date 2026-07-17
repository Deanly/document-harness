---
name: operate-document-harness
description: Operate the document harness installed in the current repository. Use when initializing, migrating, or upgrading document-harness; starting, resuming, stopping, or closing a loop-enabled task; extracting repository policy candidates; or operating the repository-local Human Control View.
---

# Operate Document Harness

Treat this skill as a repository-local router, not a new authority source. Follow the current repository's `AGENTS.md`, nested instructions, human-owned policy, approved normative designs, and deterministic validators.

## Route The Request

| Intent | Read first |
| --- | --- |
| initialize, migrate, or upgrade the harness | `docs/ADOPT.md` |
| start, resume, stop, or close loop-enabled work | `docs/EXECUTE.md`, then the current task and checkpoint |
| extract or review policy/guideline candidates | `docs/guide/repository-policy-extraction.md` |
| start, inspect, refresh, or stop the View | `docs/guide/human-control-view.md` |

Read only the exact policy, design, guide, and validator refs selected by those entrypoints. Direct-read files changed in the current task or whose retrieval freshness is uncertain.

## Operate Safely

1. Locate the repository root and read its `AGENTS.md` plus applicable nested instructions.
2. Identify the goal, repository revision, dirty tracked/untracked state, constraints, risk, and done criteria before writing.
3. For adoption, classify the target as initialize, migrate, or upgrade and produce the required no-write plan before apply. Preserve project-owned files and existing changes.
4. For execution, keep lifecycle `status` separate from `loop_state`; update the current checkpoint after meaningful actions, evidence, attention, and stop/resume transitions.
5. Never self-approve policy, standards, exceptions, migration conflicts, risk acceptance, or weakened quality gates.
6. Run the repository's fast/full/continuous gates at their defined boundaries and record exact evidence. Treat unavailable checks as blocked or not-run, never passed.
7. Refresh sanitized View inputs after meaningful state changes and wait for a newer snapshot sequence. Use exact loopback and an OS-assigned port by default; never kill a foreign process to obtain a port.
8. Stop and request attention when a required human decision, authority, secret, destructive action, remote exposure, stale fence, unresolved conflict, or recovery guarantee is missing.

## Run Adoption V1

Use the installed executable contract; do not simulate these transitions in prose.

```bash
./docs/bin/harness-adopt plan --target <repository> --profile core,governance,view --output <outside-target>/adoption-plan.json
./docs/bin/harness-adopt apply --plan <outside-target>/adoption-plan.json --expect-plan-hash <planHash>
./docs/bin/harness-adopt verify --target <repository>
./docs/bin/harness-adopt rollback --receipt <repository>/docs/receipts/harness-apply-<plan-prefix>.json
```

- Continue from `PLAN_READY`; stop on `NEEDS_DECISION` or `APPLY_FAILED` and report `writes` plus exact attention/rollback evidence.
- Treat `INSTALLED_NOT_VERIFIED` and `INSTALLED_AWAITING_REVIEW` as incomplete. Only `verify` may return `MIGRATION_VERIFIED`; successful rollback returns `ROLLED_BACK`.
- A governance install starts with an explicit extraction gap. Direct-read repository authority and write schema-valid source-linked candidates; never invent policy to make the View look populated.
- Keep code/config evidence as `kind: observation`, `approvalState: unreviewed`, with no effective or decision receipt. Human review is required before promotion.
- Never put `.env`, credentials, tokens, private raw source, secret values, personal absolute paths, or user-global skill paths into installed governance/View artifacts.
- Preserve the nested `migration.capturedRepository` fence, per-source `capturedSha256` and `capturedRepositoryRevision`. A source hash change is stale; later HEAD movement alone is not.

## Keep Scope Repository-Local

Use `.agents/skills/operate-document-harness/` as the canonical project skill. A tool-specific adapter may delegate to it, but must not duplicate its rules. Do not install, update, or depend on a user-global document-harness skill or configuration as part of repository operation.

If adoption installs this skill during the current session, read this file directly and continue under its contract. Start a new agent session or reload the repository before relying on automatic skill discovery.
