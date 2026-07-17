# Document Harness

- `ADOPT.md`: deterministic `plan → apply → verify → rollback` lifecycle.
- `EXECUTE.md`: loop execution, checkpoint, attention, and evidence entrypoint.
- `_templates/`: reusable project, task, design, guide, report, QA, and execution-checkpoint shapes.
- `bin/new-doc.sh`: creates document drafts; numbered project/task/QA drafts require a clean `main` and are committed automatically.
- `bin/validate-execution-loop.sh`: validates opt-in execution tasks and checkpoints.
- `bin/validate-closeout.sh`: validates project/task/QA completion contracts.
- `bin/close-doc.sh`: closes a project or task only after the closeout validator passes.
- `design/ubiquitous-language.md`: project-owned terminology surface that must be initialized from repository evidence.
- `guide/`: reusable goal-lock, project/task cutting, QA, and quality guidance.
- `_indexes/harness-installation.yaml`: release, plan, ownership, hash, and mode lock.
- `_indexes/governance-catalog.json`: source-linked policy/guideline candidates and human-review state.
- `receipts/`: apply, rollback, human-decision, gate, and migration evidence.
- `../runtime/document-harness-view/`: repository-local read-only Human Control View.

The View is a rebuildable projection, not an authority store. Human policy approval and required gate results must remain source-fenced receipts.

## Authoring Quick Start

```bash
./docs/bin/new-doc.sh project umbrella-project
./docs/bin/new-doc.sh task first-task
./docs/bin/new-doc.sh qa first-test-strategy
# Fill required QA fields and commit numbered drafts before creating unnumbered drafts.
./docs/bin/new-doc.sh design service-boundary
./docs/bin/new-doc.sh guide operating-rule
./docs/bin/new-doc.sh report investigation
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
```

Issue a new project only with explicit human authority. Fill generated placeholders and project-owned terminology before treating a draft as current or complete.
