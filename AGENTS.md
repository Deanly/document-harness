# AGENTS.md

## Repository Map

- `README.md` is the human quickstart for this reusable document harness.
- `CLAUDE.md` imports this file so Claude Code follows the same repository contract without duplicating authority.
- `.agents/skills/operate-document-harness/SKILL.md` is the canonical repository-local router for adoption, execution, policy extraction, and View operation.
- `.claude/skills/operate-document-harness/SKILL.md` is a thin Claude project adapter to the canonical skill.
- `docs/README.md` is the main schema for document types, issuing rules, update rules, and commands.
- `docs/ADOPT.md` is the single entrypoint for initializing, migrating, or upgrading the harness in a target repository.
- `docs/EXECUTE.md` is the single orchestration index for starting or resuming a loop-enabled task.
- `docs/design/` is reserved for DDD domain-model truth: landscape, context map, bounded-context models, ubiquitous language, and executable domain examples.
- `docs/guide/ddd-domain-design.md` defines the provider-neutral AI Domain Expert, delegated authority, Board modeling-level selection, stable model IDs, validation receipts, freshness, and delivery traceability.
- `docs/architecture/control-plane.md` is the top-level control surface for goals, pipeline, validators, and handoff rules.
- `docs/architecture/harness-adoption-plane.md` defines ownership-aware plan/apply migration, policy extraction, repo-local View, and quality handoff contracts.
- `docs/architecture/retrieval-plane.md` defines scalable search, revision, and freshness contracts.
- `docs/governance/policy-to-evidence.md` defines human policy, AI proposal, approval, exception, and traceability authority.
- `docs/governance/initiative-governance.md` defines the distinct Initiative → Project → Task hierarchy, policy/guideline relationships, approval, and legacy umbrella bridge.
- `docs/architecture/execution-loop-plane.md` defines task checkpoint, attention, stop/resume, and evidence contracts.
- `docs/architecture/human-control-view-plane.md` defines projector, snapshot API/SSE, freshness, security, and runtime boundaries.
- `docs/guide/human-control-view.md` defines how a person operates the read-only local human view.
- `docs/guide/repository-policy-extraction.md` defines how existing repository rules become reviewable policy/guideline candidates without AI self-approval.
- `docs/guide/initiative-governance.md` defines how approved policy/guideline direction becomes a human-approved `I####` 추진안 and linked delivery projects.
- `docs/guide/governance-authoring-assistance.md` defines how AI tools help non-specialists author reviewable locale-appropriate policy, guideline, and initiative drafts without taking approval authority.
- `docs/architecture/harness-language.md` holds canonical terms.
- `docs/guide/` holds reusable operating rules, including Codex guidance and artifact contracts.
- `docs/_templates/` holds templates used by `docs/bin/new-doc.sh`.
- `docs/bin/` holds deterministic helper scripts and validators.
- `docs/examples/` contains filled examples; use these before inventing a new document shape.

## Codex Workflow

- Start by reading this file and `docs/README.md`. For existing-repository adoption or migration, read `docs/ADOPT.md`; for loop-enabled work, read `docs/EXECUTE.md`, then the current task/checkpoint and only their exact policy/design/guide refs.
- Use the repository-local `operate-document-harness` skill for harness workflows. It routes to durable repository contracts and creates no authority; never install or update a user-global document-harness skill as part of this repository.
- Treat mature-repository adoption as a no-write migration plan first. Preserve project-owned files and dirty tracked/untracked changes; never wholesale-copy public harness files over customized target files.
- For ambiguous or broad work, first identify goal, context, constraints, and done criteria before editing.
- Keep changes scoped to the requested harness behavior. Avoid unrelated rewrites or style churn.
- Prefer `rg` and the scripts in `docs/bin/` for navigation and verification.
- If a file changed during the current task or retrieval freshness is uncertain, read the source file directly; never treat an index hit as authoritative.
- Treat policy, guideline, and initiative as mandatory upper governance for project/task work. Before planning, issuing, or executing delivery, direct-read the current project lineage, active approved initiative, exact effective policy/guideline refs, approval receipts, and freshness. Project/task text may refine delivery but must not weaken or reinterpret them; stop with attention on missing, stale, unapproved-required, or conflicting governance.
- Treat the authoritative current DDD model as the shared business contract for customers, planners, architects, developers, and QA. Before delivery work, identify affected bounded contexts, load the role packet from `docs/_indexes/context-packets.yaml`, and verify exact model bytes through `docs/lib/domain-design-authority.mjs`. Route semantic changes through the provider-neutral `ai-domain-expert` role. It may promote routine, reversible, evidence-backed changes only within an exact delegated-authority fence; it cannot create or widen that fence. Escalate material, strategic, conflicted, low-confidence, customer-rights, money, legal, security, organizational ownership, context split/merge, or irreversible decisions to the Board as a human-readable minimum-sufficient domain model.
- When a user needs help expressing governance, follow `docs/guide/governance-authoring-assistance.md`: ask the smallest useful questions, draft human-facing wording in clear user-language, keep policy WHY/boundary, guideline HOW/verification, and initiative outcome/portfolio separate, expose evidence and unknowns, and request exact human review. Never turn assistance into self-approval.
- Every policy, guideline, initiative, and domain item projected as normal Board content must provide a short title and complete human-facing summary in the configured `presentation.locale`. Keep IDs, paths, revisions, hashes, commands, events, and exact source text as lower-level evidence. If the human-facing presentation is missing or invalid, project only a `사람용 설명 필요` attention with the exact source ref; never substitute technical metadata as the normal card.
- Before loop-enabled execution, read the effective policy/standard refs, current task contract, and current checkpoint; keep lifecycle `status` separate from `loop_state`.
- AI may draft policy/standard/exception proposals but must not self-approve them. Pause on conflicts, stale approval fences, or missing human risk decisions.
- Keep extraction confidence, source authority, human approval, and implementation enforcement as separate fields. Code/config observations and retrieval metadata are not human policy approval.
- Repo-local View servers default to exact loopback binding and OS-assigned ports. Never kill an existing process to obtain a port, and never expose the View remotely without a separate human decision.
- After a meaningful action, validation, checkpoint, or attention change, refresh sanitized View probes and wait for a new snapshot sequence. Browser polling alone is not freshness evidence.
- Update the current checkpoint after a meaningful action, validation result, attention request, or stop/resume transition; keep task `Status` as append-only milestone history.
- When changing document rules, update the template, the guide that explains the rule, and the validator in the same change when applicable.
- Do not issue a new `initiative` or `project` document unless the user explicitly asks for it or approves it. Initiative issuance also requires an exact human issuance-approval ref; suggest the need and rationale instead of inferring authority.
- Issue numbered `initiative`/`project`/`task`/`qa` docs only from clean, up-to-date `main`; commit the draft on `main` immediately, then merge `main` back into the work branch. If the work branch is dirty, stash before switching.
- Pass Initiative issuance a safe exact human approval ref. Issue Project only under an active/approved Initiative whose repository-relative JSON activation receipt and current source/effective bytes pass `docs/lib/initiative-authority.mjs`, and issue Task only under a Project whose modern Initiative lineage passes the same gate; active/approved prose alone grants no authority. Never infer default `I0001`/`P0001`. Complete explicit legacy Project lineage is the migration-only Task-parent exception.

## Documentation Rules

- Preserve YAML frontmatter on generated markdown templates.
- Keep frontmatter properties and first-screen bullet metadata in sync.
- Keep `source_refs` populated when a claim depends on raw source material, external docs, transcripts, datasets, or official references.
- `docs/design/` is reserved for DDD domain truth. Put technical topology and mechanisms in `docs/architecture/`, and approval/governance systems in `docs/governance/`.
- DDD design documents hold current truth only after an exact-byte human-confirmed or delegated-AI authority receipt. A delegated-AI receipt must bind the approved delegation source and may cover only routine, reversible changes. `initiative`, `task`, and `project` status sections hold append-only lifecycle or execution history.
- If a reusable answer emerges from a report or conversation, promote it into `guide`, `design`, `initiative`, `project`, or `task` as appropriate.
- Prefer adding a narrow guide over expanding `docs/README.md` when a rule needs detailed explanation.

## Verification Commands

Run these after harness changes:

```bash
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-harness-adoption.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-domain-design.sh --all
./docs/bin/validate-domain-lineage.sh --all
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
git diff --check
```

When changing only a focused script or template, still run `./docs/bin/validate-codex-readiness.sh` before closing the task if feasible.

## Done Criteria

A harness change is done only when:

- The relevant docs and templates agree with each other.
- Codex-facing instructions remain concise enough to load automatically.
- Codex and Claude entrypoints delegate to the same durable contracts rather than defining competing rules.
- Validators pass or any skipped validator is explicitly explained.
- Human-owned policy and approval state are not inferred from AI-authored prose alone.
- DDD model authority is exact-byte current, source-bounded, and traceable into affected project/task/QA documents; delegated AI authority remains inside a human-defined fence, while material and strategic meaning is human-confirmed through the Board.
- Applicable governance lineage and freshness are verified before delivery work, and unresolved conflicts stop execution.
- Existing repository ownership, migration conflicts, and runtime-local state remain explicit and reversible.
- The final response names the changed surfaces and the verification result.
