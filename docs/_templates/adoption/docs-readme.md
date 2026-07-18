# Document Harness

- `ADOPT.md`: deterministic `plan → apply → verify → rollback` lifecycle.
- `EXECUTE.md`: loop execution, checkpoint, attention, and evidence entrypoint.
- `_templates/`: reusable initiative, project, task, design, guide, report, QA, and execution-checkpoint shapes.
- `bin/new-doc.sh`: creates document drafts; numbered initiative/project/task/QA drafts require a clean `main` and are committed automatically. Initiative needs a safe exact human issuance ref; Project and Task require lineage whose activation is proven by a repository-relative JSON receipt checked against current source/effective bytes.
- `bin/validate-execution-loop.sh`: validates opt-in execution tasks and checkpoints.
- `bin/validate-closeout.sh`: validates project/task/QA completion contracts.
- `bin/close-doc.sh`: closes a project or task only after the closeout validator passes.

Initiative terminal transitions are intentionally not automated by `close-doc.sh`. A human must update the canonical Initiative document, `docs/_indexes/initiative-register.json`, and the exact terminal decision receipt in one change set, then run `validate-closeout.sh` for the Initiative and for `--all`.
- `design/ubiquitous-language.md`: project-owned terminology surface that must be initialized from repository evidence.
- `guide/`: reusable goal-lock, project/task cutting, QA, and quality guidance.
- `_indexes/harness-installation.yaml`: release, plan, ownership, hash, and mode lock.
- `_indexes/governance-catalog.json`: source-linked policy/guideline candidates and human-review state.
- `receipts/`: apply, rollback, human-decision, gate, and migration evidence.
- `../runtime/document-harness-view/`: repository-local read-only Human Control View, 사용자명 `보드`.

`보드`는 top bar에 `보드 / <repository>`로 표시하고 `개요`, `정책`, `지침`, `추진안`, `검토 대기`, `실행 상태`, `근거`의 일곱 최상위 tab을 사용합니다. 정책/지침은 각각 독립 surface이며, 추진안은 정책·지침을 연결 프로젝트의 방향으로 전환합니다.

The View is a rebuildable projection, not an authority store. Human policy approval and required gate results must remain source-fenced receipts.

## Authoring Quick Start

```bash
./docs/bin/new-doc.sh initiative service-resilience DECISION-EXAMPLE
# Complete human activation review; project issuance requires I0001 to be active and approved.
./docs/bin/new-doc.sh project umbrella-project I0001
# Task issuance verifies P0001 resolves to an active, approved initiative.
./docs/bin/new-doc.sh task first-task P0001
./docs/bin/new-doc.sh qa first-test-strategy
# Fill required QA fields and commit numbered drafts before creating unnumbered drafts.
./docs/bin/new-doc.sh design service-boundary
./docs/bin/new-doc.sh guide operating-rule
./docs/bin/new-doc.sh report investigation
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
```

Replace `DECISION-EXAMPLE` with an exact human issuance-approval ref. Activation is separate: fill `docs/_templates/initiative-activation-receipt.json`, store it as repository-relative JSON, and align its human actor, approved decision, candidate ID, source revision/hashes, canonical Initiative ref and current SHA-256 with the Initiative document and register. Issue a new project only after that authority validates. Issue a Task only when its Project exists and resolves to that modern Initiative lineage; complete explicit legacy lineage fields are the migration-only exception. Never infer `I0001` or `P0001` as a default. Fill generated placeholders and project-owned terminology before treating a draft as current or complete.
