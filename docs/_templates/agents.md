# AGENTS.md

## Repository Map

- `README.md`: human quickstart and project overview.
- `CLAUDE.md`: thin Claude Code adapter that imports this file instead of duplicating rules.
- `.agents/skills/operate-document-harness/SKILL.md`: canonical repository-local router for adoption, execution, policy extraction, and View operation.
- `.claude/skills/operate-document-harness/SKILL.md`: thin Claude project adapter to the canonical skill.
- `docs/README.md`: document harness schema and commands.
- `docs/ADOPT.md`: single entrypoint for initialize/migrate/upgrade work.
- `docs/EXECUTE.md`: single orchestration index for starting or resuming a loop-enabled task.
- `docs/design/control-plane.md`: whole-system goal, active surfaces, validators, and handoff rules.
- `docs/design/harness-adoption-plane.md`: ownership-aware migration, policy extraction, repo-local View, and quality handoff.
- `docs/design/retrieval-plane.md`: scalable search, revision, and freshness contracts.
- `docs/design/policy-to-evidence-governance.md`: human policy, AI proposal, approval, exception, and traceability authority.
- `docs/design/execution-loop-plane.md`: task checkpoint, attention, stop/resume, and evidence contracts.
- `docs/design/human-control-view-plane.md`: projector, snapshot API/SSE, freshness, security, and runtime boundaries.
- `docs/guide/human-control-view.md`: operating guidance for the read-only local human view.
- `docs/guide/repository-policy-extraction.md`: source-backed candidate extraction with authority/approval/enforcement separation.
- `docs/design/ubiquitous-language.md`: canonical project terms.
- `docs/guide/`: reusable decisions, operating rules, and review criteria.
- `docs/projects/`: human-facing initiative owners.
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
- Before loop-enabled execution, read effective policy/standard refs, the current task contract, and the current checkpoint; keep lifecycle `status` separate from `loop_state`.
- AI may draft policy/standard/exception proposals but must not self-approve them. Pause on conflicts, stale approval fences, or missing human risk decisions.
- Keep extraction confidence, source authority, human approval, and implementation enforcement separate. Never treat code/config observation or retrieval metadata as human approval.
- Use exact loopback + OS-assigned port for repo-local View by default; never kill a foreign process or bind remotely without separate human authority.
- After meaningful action, validation, checkpoint, or attention changes, refresh sanitized View probes and wait for a new snapshot sequence; browser polling alone is not freshness evidence.
- Update the current checkpoint after meaningful action, evidence, attention, or stop/resume transitions; keep task `Status` as append-only milestone history.
- Do not issue a new `project` document without explicit human approval.
- Issue numbered `project`/`task`/`qa` docs only from clean, up-to-date `main`; commit the draft on `main` immediately, then merge `main` back into the work branch. If the work branch is dirty, stash before switching.

## Documentation Rules

- Preserve YAML frontmatter and keep it synchronized with first-screen bullet metadata.
- Keep `source_refs` attached to source-backed claims.
- Update folder `README.md` files when active documents change.
- Update `docs/design/ubiquitous-language.md` when canonical terms change.
- Promote reusable reports or answers into `guide`, `design`, `project`, or `task`.

## Verification Commands

```bash
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-harness-adoption.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
git diff --check
```

## Done Criteria

- Relevant docs, templates, and validators agree.
- Required validators pass, or skipped validators are explained.
- Human-owned policy and approval state are not inferred from AI-authored prose alone.
- Existing repository ownership, dirty state, and runtime-local rollback boundaries remain explicit.
- The final response summarizes changed surfaces and evidence.
