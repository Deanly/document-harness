# AGENTS.md

## Repository Map

- `README.md`: human quickstart and project overview.
- `CLAUDE.md`: thin Claude Code adapter that imports this file instead of duplicating rules.
- `.agents/skills/operate-document-harness/SKILL.md`: canonical repository-local router for adoption, execution, policy extraction, and `Board` operation.
- `.claude/skills/operate-document-harness/SKILL.md`: thin Claude project adapter to the canonical skill.
- `docs/README.md`: document harness schema and commands.
- `docs/ADOPT.md`: single entrypoint for initialize/migrate/upgrade work.
- `docs/EXECUTE.md`: single orchestration index for starting or resuming a loop-enabled task.
- `docs/design/`: DDD-only domain landscape, context map, bounded-context models, ubiquitous language, and executable domain examples.
- `docs/guide/ddd-domain-design.md`: AI Domain Expert semantics control, delegated authority, Board modeling-level selection, stable model IDs, exact-byte validation, freshness, and delivery traceability.
- `docs/architecture/control-plane.md`: whole-system goal, active surfaces, validators, and handoff rules.
- `docs/architecture/harness-adoption-plane.md`: ownership-aware migration, policy extraction, repo-local View, and quality handoff.
- `docs/architecture/retrieval-plane.md`: scalable search, revision, and freshness contracts.
- `docs/governance/policy-to-evidence.md`: human policy, AI proposal, approval, exception, and traceability authority.
- `docs/governance/initiative-governance.md`: Initiative → Project → Task hierarchy, approval, policy/guideline relationships, and legacy bridge.
- `docs/architecture/execution-loop-plane.md`: task checkpoint, attention, stop/resume, and evidence contracts.
- `docs/architecture/human-control-view-plane.md`: projector, snapshot API/SSE, freshness, security, and runtime boundaries.
- `docs/guide/human-control-view.md`: operating guidance for the read-only local human view.
- `docs/guide/repository-policy-extraction.md`: source-backed candidate extraction with authority/approval/enforcement separation.
- `docs/guide/initiative-governance.md`: human-approved 추진안 issuance, activation, linkage, and migration workflow.
- `docs/guide/governance-authoring-assistance.md`: question-led locale-appropriate authoring assistance for policy, guideline, and initiative review.
- `docs/architecture/harness-language.md`: canonical project terms.
- `docs/guide/`: reusable decisions, operating rules, and review criteria.
- `docs/initiatives/`: human-facing strategy and portfolio owners (`추진안`, `I####`).
- `docs/projects/`: bounded delivery projects linked to an initiative.
- `docs/tasks/`: executable work slices.
- `docs/reports/`: time-bound reports that may be promoted into durable docs.
- `docs/qa/`: current QA strategies, plans, case catalogs, and runbooks.
- `docs/bin/`: document generation and validation scripts.

## Codex Workflow

- Start each task by identifying goal, context, constraints, and done criteria.
- Read `docs/README.md` first. For existing-repository adoption, read `docs/ADOPT.md`; for loop-enabled work, read `docs/EXECUTE.md`, then the current task/checkpoint and only their exact policy/design/guide refs.
- Use the repository-local `operate-document-harness` skill for harness workflows. It routes to durable repository contracts and creates no authority; never install or update a user-global document-harness skill as part of this repository.
- Treat mature-repository adoption as a no-write migration plan first. Preserve project-owned files and dirty tracked/untracked changes.
- Use `docs/bin/` scripts instead of ad hoc document mutation when a script exists.
- Keep changes narrow and aligned with the existing document contracts.
- If a file changed during the current task or retrieval freshness is uncertain, read the source file directly; never treat an index hit as authoritative.
- Treat policy, guideline, and initiative as mandatory upper governance. Before planning, issuing, or executing project/task work, direct-read the current lineage, active approved initiative, exact effective policy/guideline refs, approval receipts, and freshness. Delivery documents may refine but never weaken or reinterpret them; stop with attention on missing, stale, unapproved-required, or conflicting governance.
- Treat the authoritative current DDD model as the shared business contract for customers, planners, architects, developers, and QA. Route semantic changes through `ai-domain-expert` and verify exact model bytes through `docs/lib/domain-design-authority.mjs`. It may promote routine, reversible changes only inside an exact human-defined delegation fence; important, conflicted, low-confidence, organizational, regulated, customer-rights, money, security, context split/merge, or irreversible decisions require a minimum-sufficient Board model and human decision.
- When helping a user author governance, follow `docs/guide/governance-authoring-assistance.md`: ask small decision-focused questions, draft clear user-language, keep policy WHY/boundary, guideline HOW/verification, and initiative outcome/portfolio separate, expose evidence/unknowns, and leave approval to the human.
- Before loop-enabled execution, read effective policy/standard refs, the current task contract, and the current checkpoint; keep lifecycle `status` separate from `loop_state`.
- AI may draft policy/standard/exception proposals but must not self-approve them. Pause on conflicts, stale approval fences, or missing human risk decisions.
- Keep extraction confidence, source authority, human approval, and implementation enforcement separate. Never treat code/config observation or retrieval metadata as human approval.
- Treat `Board` as the configurable user-facing name of the repo-local View. Route “View start” to `human-view start` followed by `url`, use exact loopback + OS-assigned port, and never kill a foreign process or bind remotely without separate human authority.
- After meaningful action, validation, checkpoint, or attention changes, refresh sanitized View probes and wait for a new snapshot sequence; browser polling alone is not freshness evidence.
- Update the current checkpoint after meaningful action, evidence, attention, or stop/resume transitions; keep task `Status` as append-only milestone history.
- Do not issue a new `initiative` or `project` document without explicit human approval. Initiative issuance additionally requires an exact human issuance-approval ref.
- Issue numbered `initiative`/`project`/`task`/`qa` docs only from clean, up-to-date `main`; commit the draft on `main` immediately, then merge `main` back into the work branch. If the work branch is dirty, stash before switching.
- Pass Initiative issuance a safe exact human approval ref. Issue Project only under an active/approved Initiative, and issue Task only under a Project whose modern Initiative lineage resolves active/approved; never infer default `I0001`/`P0001`. Complete explicit legacy Project lineage is the migration-only Task-parent exception.

## Documentation Rules

- Preserve YAML frontmatter and keep it synchronized with first-screen bullet metadata.
- Keep `source_refs` attached to source-backed claims.
- `docs/design/` is reserved for DDD domain-model truth. Put technical mechanisms in `docs/architecture/` and authority systems in `docs/governance/`.
- Update folder `README.md` files when active documents change.
- Update `docs/architecture/harness-language.md` when canonical terms change.
- Promote reusable reports or answers into `guide`, `design`, `initiative`, `project`, or `task`.

## Verification Commands

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

## Done Criteria

- Relevant docs, templates, and validators agree.
- Required validators pass, or skipped validators are explained.
- Human-owned policy and approval state are not inferred from AI-authored prose alone.
- DDD model authority is human-owned, exact-byte approved, current, and traceable into affected project/task/QA documents.
- Applicable governance lineage and freshness are verified before delivery work, and unresolved conflicts stop execution.
- Existing repository ownership, dirty state, and runtime-local rollback boundaries remain explicit.
- The final response summarizes changed surfaces and evidence.
