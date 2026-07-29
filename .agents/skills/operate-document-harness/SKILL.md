---
name: operate-document-harness
description: Operate the document harness installed in the current repository. Use when initializing, migrating, or upgrading document-harness; discovering, authoring, reviewing, validating, or consuming DDD domain models; starting, resuming, stopping, or closing loop-enabled work; extracting, authoring, reviewing, or relating policy, guideline, and initiative governance; helping a user turn plain-language direction into reviewable locale-appropriate governance drafts; or operating the repository-local Human Control View named “Board”, including requests such as “View start”, “View status”, “View refresh”, or “View stop”.
---

# Operate Document Harness

Treat this skill as a repository-local router, not a new authority source. Follow the current repository's `AGENTS.md`, nested instructions, human-owned policy, approved normative designs, and deterministic validators.

## Route The Request

| Intent | Read first |
| --- | --- |
| initialize, migrate, or upgrade the harness | `docs/ADOPT.md` |
| start, resume, stop, or close loop-enabled work | `docs/EXECUTE.md`, then the current task and checkpoint |
| extract or review policy/guideline candidates | `docs/guide/repository-policy-extraction.md` |
| help a user author or revise policy, guideline, or initiative | `docs/guide/governance-authoring-assistance.md` |
| create, review, activate, or connect an initiative | `docs/guide/initiative-governance.md` |
| discover, author, review, or change a domain model | `docs/guide/ddd-domain-design.md`, then `docs/design/domain-landscape.md`, `docs/design/context-map.md`, and the affected context set |
| start, inspect, refresh, or stop `Board` / the View | `docs/guide/human-control-view.md` |

Read only the exact policy, design, guide, and validator refs selected by those entrypoints. Direct-read files changed in the current task or whose retrieval freshness is uncertain.

## Operate Safely

1. Locate the repository root and read its `AGENTS.md` plus applicable nested instructions.
2. Identify the goal, repository revision, dirty tracked/untracked state, constraints, risk, and done criteria before writing.
3. Before planning, issuing, or executing project/task work, run the governance preflight in `docs/guide/governance-authoring-assistance.md`: direct-read the current lineage, then require the repository-relative JSON Initiative activation receipt and current source/effective bytes to pass `docs/lib/initiative-authority.mjs`; active/approved prose alone is not authority. Also read exact effective policy/guideline refs and freshness. Delivery work may refine but never weaken or reinterpret upper governance.
4. Run the DDD preflight in `docs/guide/ddd-domain-design.md`: identify affected bounded contexts, load the actor-specific packet, and require approved/current exact model bytes to pass `docs/lib/domain-design-authority.mjs`. Customer, planner, architect, developer, and QA use the same model IDs through different role views; project/task/QA documents must declare their domain impact and traceability.
5. Stop and request attention rather than write when required governance or domain truth is missing, stale, unapproved, disputed, or conflicting. Treat an explicitly marked legacy bridge separately, but never hide its initiative or domain gap or bypass exact policy/normative refs.
6. For adoption, classify the target as initialize, migrate, or upgrade and produce the required no-write plan before apply. Preserve project-owned files and existing changes.
7. For initialization, migration, policy extraction, and governance authoring, write human-facing `direction`, `title`, `humanSummary`, `why`, `scope`, `risk`, attention/gap wording, `approvalRule`, project description, source-reference `note`, and free-text `evidenceKind` labels in clear user-language (configured `presentation.locale`) by default. Preserve technical IDs, enum values, repository-relative paths, hashes, commands, exact source headings, and quoted source wording in their original form.
8. Treat translation as presentation-only migration: do not change meaning, authority class/state, approval state, enforcement, evidence, source refs, source hashes, or decision receipts while localizing wording.
9. For execution, keep lifecycle `status` separate from `loop_state`; update the current checkpoint after meaningful actions, evidence, attention, and stop/resume transitions.
10. Never self-approve policy, standards, guidelines, initiatives, domain models, exceptions, migration conflicts, risk acceptance, or weakened quality gates.
11. Run the repository's fast/full/continuous gates at their defined boundaries and record exact evidence. Treat unavailable checks as blocked or not-run, never passed.
12. Refresh sanitized View inputs after meaningful state changes and wait for a newer snapshot sequence. Use exact loopback and an OS-assigned port by default; never kill a foreign process to obtain a port.
13. Stop and request attention when a required human decision, authority, secret, destructive action, remote exposure, stale fence, unresolved conflict, or recovery guarantee is missing.

## Assist Governance Authoring

Read `docs/guide/governance-authoring-assistance.md` completely before turning a user's plain-language direction into governance documents.

1. Restate the protected result and current problem in the user's language; separate source fact, inference, assumption, and unknown.
2. Ask the smallest useful question set first. Offer 2–3 explained alternatives when the user cannot choose a target, boundary, method, or success signal.
3. Draft human-facing content in clear user-language while preserving IDs, enums, paths, commands, headings, quotations, revisions, and hashes.
4. Keep policy as WHY/non-waivable boundary, guideline as HOW/applicability/verification, and initiative as outcome/portfolio. Do not move implementation detail into policy or project/task state into initiative.
5. Show provenance, applicability, verification, affected delivery, unknowns, risks, and the exact human decision needed. Keep proposal, approval, effective authority, enforcement, and freshness separate.
6. Use unnumbered candidates until the relevant human gate is satisfied. Initiative issuance and activation remain separate approvals; no AI wording or View state grants either one.

## Operate Board

Treat the configured `presentation.displayName` (default `Board`) as the user-facing name and keep `human-view` as the technical command. Apply these phrases only to the current repository:

| User phrase | Action |
| --- | --- |
| `View start`, `View open` | run `./runtime/document-harness-view/bin/human-view start`, then `url`, and return the local address |
| `View status` | run `./runtime/document-harness-view/bin/human-view status` |
| `View refresh` | run `./runtime/document-harness-view/bin/human-view refresh`, then confirm a newer snapshot sequence |
| `View stop` | run `./runtime/document-harness-view/bin/human-view stop` |

Keep `<displayName> / <repository>` visible as the fixed top-left identity. Expect configured `tabLabels` in the canonical key order `overview`, `domain`, `policies`, `guidelines`, `initiatives`, `review`, `execution`, `evidence`. The Domain tab projects the DDD landscape, context map, model validation/freshness, role views, and open questions without granting model authority. Treat domain, policy, guideline, and initiative as independent first-class surfaces. Initiative directly links policy WHY and selected guideline HOW, while projects own `related_initiative` and the View reverse-indexes their status/path without inventing progress.

Do not interpret these phrases as authority to choose another repository, bind remotely, claim a fixed port, kill a foreign process, mutate governance, approve a candidate, or execute project work.

The exact phrases `View start` and `View screen` route to the View. Phrases such as `target board`, hardware board selection, or board-porting context continue to mean a physical/target board and must not start the View.

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
- A governance install starts with explicit policy and initiative extraction gaps. Direct-read repository authority, extract policy/guideline candidates first, then inspect existing project/design/roadmap/task sources for outcome portfolios.
- After policy/guideline extraction, leave an explicit, observable initiative bootstrap state: at least one source-backed `INIT-*` migration candidate in `unreviewed|review_requested` with existing `P####`, policy/guideline relationships, success signals and exact source fences, or the paired `ATTN-INITIATIVE-EXTRACTION` + `GAP-INITIATIVE-EXTRACTION`. Rejected, stale, or superseded history alone does not close the gap; never leave an unexplained empty register.
- Keep `INIT-*` at `draft` with no effective/document/decision receipt. Do not infer `I####` issuance, activation, or approval; ask the user to review the candidate or the missing source/portfolio decision in clear user-language.
- Use the configured user-facing locale for synthesized human wording even when the source or technical identifiers are English. Keep exact source headings and quotations unchanged, and provide a user-language summary beside them instead of translating provenance.
- Keep code/config evidence as `kind: observation`, `approvalState: unreviewed`, with no effective or decision receipt. Human review is required before promotion.
- Never put `.env`, credentials, tokens, private raw source, secret values, personal absolute paths, or user-global skill paths into installed governance/View artifacts.
- Preserve the nested `migration.capturedRepository` fence, per-source `capturedSha256` and `capturedRepositoryRevision`. A source hash change is stale; later HEAD movement alone is not.

## Keep Scope Repository-Local

Use `.agents/skills/operate-document-harness/` as the canonical project skill. A tool-specific adapter may delegate to it, but must not duplicate its rules. Do not install, update, or depend on a user-global document-harness skill or configuration as part of repository operation.

If adoption installs this skill during the current session, read this file directly and continue under its contract. Start a new agent session or reload the repository before relying on automatic skill discovery.
