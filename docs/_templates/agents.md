# AGENTS.md

## Repository Map

- `README.md`: human quickstart and project overview.
- `docs/README.md`: document harness schema and commands.
- `docs/design/control-plane.md`: whole-system goal, active surfaces, validators, and handoff rules.
- `docs/design/ubiquitous-language.md`: canonical project terms.
- `docs/guide/`: reusable decisions, operating rules, and review criteria.
- `docs/projects/`: human-facing initiative owners.
- `docs/tasks/`: executable work slices.
- `docs/reports/`: time-bound reports that may be promoted into durable docs.
- `docs/bin/`: document generation and validation scripts.

## Codex Workflow

- Start each task by identifying goal, context, constraints, and done criteria.
- Read `docs/README.md` and the active design/project/task surfaces before editing.
- Use `docs/bin/` scripts instead of ad hoc document mutation when a script exists.
- Keep changes narrow and aligned with the existing document contracts.
- Do not issue a new `project` document without explicit human approval.
- Issue numbered `project`/`task` docs only from clean, up-to-date `main`; commit the draft on `main` immediately, then merge `main` back into the work branch. If the work branch is dirty, stash before switching.

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
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-closeout.sh --all
git diff --check
```

## Done Criteria

- Relevant docs, templates, and validators agree.
- Required validators pass, or skipped validators are explained.
- The final response summarizes changed surfaces and evidence.
