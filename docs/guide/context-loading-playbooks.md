---
type: guide
title: context-loading-playbooks
status: current
owner: Codex
created: 2026-05-16
updated: 2026-05-16
related_project: []
related_task:
  - docs/tasks/T0001-retrieval-plane-baseline.md
related_design:
  - docs/design/control-plane.md
  - docs/design/ubiquitous-language.md
source_refs:
  - ../silverstone-core/docs/reports/2026-05-16-document-taxonomy-context-window-analysis.md
tags:
  - docs/guide
  - context-window
---

# context-loading-playbooks

- Type: guide
- Status: current
- Owner: Codex
- Created: 2026-05-16
- Updated: 2026-05-16
- Current Focus: reusable document harness에서 work type별 context loading rule을 고정한다.
- Related Task: docs/tasks/T0001-retrieval-plane-baseline.md
- Related Design: docs/design/control-plane.md; docs/design/ubiquitous-language.md

## Purpose

이 문서는 Codex/LLM이 문서 하네스 corpus를 작업 성격에 맞게 읽도록 하는 context-loading playbook입니다.

핵심 원칙은 current truth를 먼저 읽고, active ledger를 그 다음에 읽고, historical evidence는 명시적 이유가 있을 때만 읽는 것입니다. 템플릿/예시 저장소에서도 이 규칙을 둬야 downstream 프로젝트가 문서 수 증가 시 같은 문제를 반복하지 않습니다.

## Principles

- Load current truth before historical evidence.
- Load active ledger before done ledger.
- Treat `docs/design/ubiquitous-language.md` as section-load unless the task is terminology governance.
- Use `docs/design/README.md` to choose design docs instead of loading all design docs.
- Use `docs/_indexes/active-docs.md` and folder README files to find active work.
- Record `Context Used` and `Skipped` in closeout when the task was broad or retrieval-sensitive.

## Default Search Recipes

### Current Search

```bash
rg "query" docs
```

### Design-First Search

```bash
rg "query" docs/design docs/guide
```

### Active Ledger Search

```bash
rg "query" docs/_indexes/active-docs.md docs/tasks docs/projects
```

## Work Type: docs_harness

### Load

- `docs/README.md`
- `docs/design/control-plane.md`
- `docs/guide/llm-wiki-operations.md`
- `docs/guide/context-loading-playbooks.md`
- relevant templates and validators

### Avoid By Default

- all project/task history
- full `docs/design/ubiquitous-language.md`
- examples unless checking shape

### Search Order

1. docs README
2. control-plane
3. harness guides
4. templates and validators
5. active docs/indexes
6. examples only for shape confirmation

### Context Used Output

List validators run and state that runtime verification was not needed for docs-only changes.

## Work Type: design_change

### Load

- `docs/design/control-plane.md`
- `docs/design/README.md`
- target design doc
- relevant `ubiquitous-language` sections if terms change
- related task/project if delivery state changes

### Avoid By Default

- all design docs
- all tasks mentioning the topic
- full `ubiquitous-language.md`

### Search Order

1. design README
2. target design
3. selected UL section
4. related project/task

### Context Used Output

Name the design truth changed, any UL terms touched, and downstream project/task updates.

## Work Type: project_task_execution

### Load

- current task doc
- parent/reference project doc
- `docs/design/control-plane.md`
- directly referenced design docs
- relevant guide or validator docs

### Avoid By Default

- unrelated tasks under the same project
- all completed tasks
- full `ubiquitous-language.md`

### Search Order

1. current task
2. parent/reference project
3. referenced design docs
4. sibling tasks only if WBS/evidence depends on them

### Context Used Output

List the task, project, design docs, and validation commands used.

## Work Type: report_synthesis

### Load

- requested sources
- relevant current truth design
- relevant guide if the answer may become reusable
- target report template

### Avoid By Default

- turning reports into current truth without promotion
- full design corpus
- full task/project history

### Search Order

1. requested sources
2. current design truth
3. relevant guide
4. project/task only if handoff changes

### Context Used Output

List source_refs and state whether follow-up promotion is needed.

## Work Type: closeout

### Load

- target project/task doc
- related control-plane
- related design docs
- validators referenced by the doc

### Avoid By Default

- unrelated sibling tasks
- historical docs not cited by completion evidence

### Search Order

1. target doc
2. goal inventory and verification sections
3. related design/control-plane
4. required validators

### Context Used Output

State goals closed, validators run, skipped runtime verification if docs-only, and residual risks.

## Change Log

- 2026-05-16: reusable context loading playbooks created.
