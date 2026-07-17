---
type: guide
title: context-loading-playbooks
status: current
owner: Codex
created: 2026-05-16
updated: 2026-07-15
related_project: []
related_task: []
related_design:
  - docs/design/control-plane.md
  - docs/design/retrieval-plane.md
  - docs/design/ubiquitous-language.md
source_refs:
  - https://arxiv.org/abs/2104.08663
  - https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
tags:
  - docs/guide
  - context-window
---

# context-loading-playbooks

- Type: guide
- Status: current
- Owner: Codex
- Created: 2026-05-16
- Updated: 2026-07-15
- Current Focus: reusable document harness에서 work type별 context loading rule을 고정한다.
- Related Task:
- Related Design: docs/design/control-plane.md; docs/design/retrieval-plane.md; docs/design/ubiquitous-language.md

## Purpose

이 문서는 Codex/LLM이 문서 하네스 corpus를 작업 성격에 맞게 읽도록 하는 context-loading playbook입니다.

핵심 원칙은 current truth를 먼저 읽고, active ledger를 그 다음에 읽고, historical evidence는 명시적 이유가 있을 때만 읽는 것입니다. 템플릿/예시 저장소에서도 이 규칙을 둬야 downstream 프로젝트가 문서 수 증가 시 같은 문제를 반복하지 않습니다.

## Principles

- Load current truth before historical evidence.
- Load active ledger before done ledger.
- Treat `docs/design/ubiquitous-language.md` as section-load unless the task is terminology governance.
- Use `docs/design/README.md` to choose design docs instead of loading all design docs.
- Use `docs/_indexes/active-docs.md` and folder README files to find active work.
- Treat hybrid index results as candidates; fetch the authoritative source section before using a claim or editing.
- Read files changed in the current task directly until the required source revision is confirmed searchable.
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

### Hybrid Candidate Search

When a downstream hybrid runtime is configured, use this order:

1. prefilter by current registry revision and project/source/type/status/sensitivity
2. keyword/term/direct source candidates for exact identifiers
3. BM25 and multilingual dense candidates from one logical read fence
4. same-revision RRF fusion and tombstone filtering
5. direct fetch plus source hash/revision verification of the cited section

If the runtime cannot prove freshness for a file changed in this task, skip its stale hit and read the source directly.

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
- effective policy/standard refs and active exception, when present
- current execution checkpoint for `execution_contract: v1`

### Avoid By Default

- unrelated tasks under the same project
- all completed tasks
- full `ubiquitous-language.md`

### Search Order

1. current task
2. parent/reference project
3. referenced design docs
4. sibling tasks only if WBS/evidence depends on them
5. current checkpoint and latest referenced receipts; do not load full chat history

### Context Used Output

List the task, project, design docs, and validation commands used.

## Work Type: execution_resume

### Load

- `docs/EXECUTE.md`
- current task document and exact task contract revision
- current execution checkpoint
- `docs/design/execution-loop-plane.md`
- `docs/_indexes/execution-loop-policy.yaml`
- exact effective policy/standard/exception refs
- latest referenced decision and verification receipts

### Avoid By Default

- full chat or terminal history
- unrelated sibling tasks
- superseded policy/standard versions
- raw logs already summarized by immutable receipts

### Search Order

1. task contract and current checkpoint revision fence
2. open attention, next actor/action, resume condition
3. exact effective rule and exception refs
4. latest receipt evidence
5. only then directly required source/code/guide

### Context Used Output

State task contract revision, attempt/checkpoint sequence, loop state, next actor/action, effective rule refs, receipt refs, and any stale/degraded source.

## Work Type: policy_governance

### Load

- exact human policy source or mapping design
- `docs/design/policy-to-evidence-governance.md`
- `docs/guide/policy-proposal-and-approval.md`
- affected normative designs, tasks, and QA rows
- exact approval/exception receipts

### Avoid By Default

- treating proposal reports as effective authority
- all policies or task history outside the affected domain
- guessing approval from prose or an unverified `approved_by` field

### Search Order

1. human policy clause and normative version
2. effective standard and approval revision
3. active exception overlays
4. affected task goals and QA checks
5. proposal/options only for unresolved decisions

### Context Used Output

Separate effective rules, proposals, assumptions, conflicts, and the exact human decision required.

## Work Type: human_view_runtime

### Load

- `docs/design/human-control-view-plane.md`
- `docs/guide/human-control-view.md`
- `docs/design/retrieval-plane.md`
- representative fixture가 사용하는 `docs/design/execution-loop-plane.md` section
- registered source/sensitivity policy
- representative policy, task, checkpoint, attention, receipt fixtures
- downstream runtime security/deployment design

### Avoid By Default

- using browser cache or projection DB as work truth
- loading all task history or raw logs into the overview
- treating proposal reports as effective policy
- adding write capability while designing a read-only view

### Search Order

1. source authority, snapshot, freshness, security boundary
2. canonical loop/policy/attention schema
3. representative source fixtures and acceptance scenarios
4. GET/SSE/polling runtime implementation
5. optional approval broker only as a separately approved boundary

### Context Used Output

State source roots, snapshot fence, freshness state, exposed capabilities, security profile, runtime checks, and which mutation paths remain disabled.

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

## Work Type: retrieval_incident

### Load

- `docs/design/retrieval-plane.md`
- `docs/guide/hybrid-retrieval-and-freshness.md`
- `docs/_indexes/retrieval-policy.yaml`
- affected source files
- document head, registry snapshot, arm receipts, logical read fence, relevant golden queries

### Avoid By Default

- all design or task history
- unrelated source roots
- trusting an index result as freshness evidence

### Search Order

1. authoritative affected source and current content hash
2. source/index revision and tombstone state
3. pending ingest and watcher/scanner health
4. BM25/dense/fused raw candidates
5. related design or execution history only if the contract changed

### Context Used Output

State the affected source revision, whether direct-read fallback was used, visibility lag, reconciliation result, and any stale hit removed.

## References

- [BEIR](https://arxiv.org/abs/2104.08663)
- [Reciprocal Rank Fusion](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)

## Change Log

- 2026-05-16: reusable context loading playbooks created.
- 2026-07-15: hybrid candidate search, direct source freshness rule, retrieval incident packet added.
- 2026-07-15: execution resume and policy governance packets added; current checkpoint and exact effective rules replace broad chat/history loading.
