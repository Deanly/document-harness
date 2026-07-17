---
type: design
title: control-plane
status: current
domain: control-plane
owner:
created: 2026-04-14
updated: 2026-07-16
retrieval_class:
  - core-start
context:
  default_load: true
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/README.md
related_task:
  - docs/tasks/T0001-retrieval-plane-baseline.md
source_refs: []
tags:
  - docs/design
  - control-plane
---

# control-plane

- Type: design
- Domain: control-plane
- Owner:
- Created: 2026-04-14
- Updated: 2026-07-16
- Referenced By:
  - `docs/README.md`

## Purpose

이 문서는 전체 시스템 목표, 표준 pipeline, active control surface, quality axis, validator를 한 곳에 모아 두는 central control surface입니다.

`design`이 전체를 놓치지 않게 만드는 장치라면, 이 문서는 그 `design` 문서들 사이의 상위 정렬면입니다. 새 `project`와 `task`는 이 문서를 whole-system anchor로 참조해야 하며, human-facing initiative의 기본 owner는 umbrella `project`로 유지합니다.

## Whole-System Outcome

- 이 저장소가 어떤 개발 목표를 끝까지 추적해야 하는지 적습니다.
- 시스템 규모와 코드 규모가 커져도 무엇을 전체 truth로 유지해야 하는지 적습니다.
- 부분 작업 문서가 무엇을 절대 잃어버리면 안 되는지 적습니다.

## Control Surfaces

### Whole-System Control

- `docs/design/control-plane.md`
- `docs/design/ubiquitous-language.md`
- root `AGENTS.md`
- 현재 시스템 경계를 정의하는 핵심 `design` 문서

### Focused Execution

- active umbrella `project`
- 예외 조건을 만족한 active branch `project`
- active `task`
- WBS와 gate가 있는 실행 문서

### Human Governance

- `docs/design/policy-to-evidence-governance.md`
- `docs/design/harness-adoption-plane.md`
- `governance_role: human-policy` 또는 `normative-standard` design
- `governance_role: proposal` report
- exact revision에 묶인 human approval / exception receipt
- Policy Clause → Standard Rule → Task Goal → QA Check → Evidence traceability

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `./docs/bin/new-doc.sh`
- `docs/guide/quality-axes.md`
- YAML frontmatter properties
- `source_refs`
- `docs/_indexes/retrieval-policy.yaml`
- `docs/_indexes/execution-loop-policy.yaml`
- `./docs/bin/validate-codex-readiness.sh`
- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-harness-adoption.sh`
- `./docs/bin/validate-doc-retrieval.sh`
- `./docs/bin/validate-execution-loop.sh --all`
- `./docs/bin/validate-closeout.sh`

### Codex Agent Control

- root `AGENTS.md`
- repository-local `.agents/skills/operate-document-harness/SKILL.md`
- thin `.claude/skills/operate-document-harness/SKILL.md` adapter
- `docs/_templates/agents.md`
- `docs/guide/codex-agent-guidance.md`
- `docs/bin/validate-codex-readiness.sh`

### Source-Backed Knowledge

- project-specific immutable `raw/` or `sources/` directory
- generated markdown surfaces with `source_refs`
- folder README files as lightweight indexes
- `Status` and `Change Log` sections as chronological logs
- `docs/design/retrieval-plane.md` as the scalable retrieval and freshness contract

## Active Design Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/design/control-plane.md` | 전체 목표, pipeline, validator 정렬 | Active | |
| `docs/design/retrieval-plane.md` | hybrid 검색, revision, freshness, 복구 계약 | Active | 규모/freshness trigger가 있을 때 선택 |
| `docs/design/policy-to-evidence-governance.md` | human policy, AI proposal, approval, exception, evidence traceability | Active | governance-sensitive work에서 선택 |
| `docs/design/execution-loop-plane.md` | checkpoint, attention, stop/resume, evidence barrier | Active | loop-enabled task 실행에서 선택 |
| `docs/design/human-control-view-plane.md` | projector, snapshot API/SSE, freshness, read-only security/runtime | Active | human view runtime 설계에서 선택 |
| `docs/design/harness-adoption-plane.md` | executable ownership-aware initialize/migrate/upgrade/verify/rollback, policy extraction, versioned repo-local View/quality handoff | Active | public v1 CLI/schema/release/status contract; existing repository adoption에서 선택 |
| `docs/design/ubiquitous-language.md` | canonical term 정렬 | Active | |
| `docs/design/<domain>.md` | 현재 시스템 경계와 계약 | Add | 필요한 도메인 설계를 추가합니다. |

## Umbrella Initiative Policy

- human이 인식하는 하나의 product, initiative, workstream은 기본적으로 umbrella `project` 1개로 유지합니다.
- 새 work는 먼저 기존 umbrella `project` 아래의 새 `task`로 수용 가능한지 검토합니다.
- 새 `project` 발급은 사람만 하며, 에이전트는 발급 필요성과 근거만 제안합니다.
- 새 `project`는 사용자 명시 요청, 본질적인 completion mode 분리, owner/운영 검증 체계 분리 같은 예외가 명확할 때만 허용합니다.
- 새 `project`가 필요하다면 `Project Issuance Check`에 왜 task가 안 되는지와 왜 human에게 더 읽기 쉬운지 남깁니다.
- 번호가 붙는 `project`와 `task` 문서는 clean, up-to-date `main`에서만 발급하고, 생성된 `draft`를 즉시 `main`에 commit합니다.

## Active Umbrella Projects

| Umbrella Project | Initiative | Status | Notes |
| --- | --- | --- | --- |
| `docs/projects/<P0001-slug>.md` | human-facing initiative owner | Add | active umbrella project를 여기에 적습니다. |

## Active Execution Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/ADOPT.md` | new/mature/versioned repository adoption orchestration | Active | `harness-adopt plan|apply|verify|rollback`; migration은 target 밖 no-write plan과 ownership fence부터 시작 |
| `.agents/skills/operate-document-harness/SKILL.md` | repository-local adoption/execution/policy/View workflow router | Active | user-global install 없이 durable repository entrypoint로 위임 |
| `docs/EXECUTE.md` | loop-enabled task 시작·재개·중단·closeout orchestration | Active | current task/checkpoint와 exact authority refs 앞에서 읽는 실행 진입점 |
| `docs/projects/README.md` | active umbrella-first project 입구 | Active | lineage가 먼저 보여야 합니다. |
| `docs/tasks/README.md` | active task 입구 | Active | 각 task의 umbrella owner가 드러나야 합니다. |
| `docs/reports/README.md` | active report 입구 | Active | |
| `docs/qa/README.md` | current QA 입구 | Active | strategy/plan/cases/runbook selection surface |
| `docs/design/README.md` | design retrieval 입구 | Active | design corpus selection index |
| `docs/_indexes/active-docs.md` | active docs retrieval index | Active | README active surface와 함께 유지합니다. |
| `docs/_indexes/design-map.md` | compact design retrieval map | Active | `docs/design/README.md`에서 파생됩니다. |
| `docs/_indexes/context-packets.yaml` | context packet manifest | Active | default broad-load guard 대상입니다. |
| `docs/_indexes/retrieval-policy.yaml` | machine-readable retrieval/freshness defaults | Active | runtime backend와 독립적인 계약 |
| `docs/_indexes/execution-loop-policy.yaml` | machine-readable state, risk, retry/stop, receipt defaults | Active | executor/runtime vendor와 독립적인 계약 |
| `docs/guide/context-loading-playbooks.md` | work-type context loading rules | Active | Codex/LLM context-window 선택 기준 |
| `docs/guide/hybrid-retrieval-and-freshness.md` | incremental ingest와 same-session fallback | Active | runtime 도입·장애 시 운영 절차 |
| `docs/guide/policy-proposal-and-approval.md` | policy intake, proposal, human approval, exception 운영 | Active | governance change와 policy conflict에서 선택 |
| `docs/guide/execution-loop-operations.md` | reproduce, small change, verify, checkpoint, review 절차 | Active | loop-enabled task 실행에서 선택 |
| `docs/guide/human-control-view.md` | read-only local status/policy/evidence view 계약 | Active | user-facing projection runtime 설계에서 선택 |
| `docs/guide/repository-policy-extraction.md` | repository rule discovery, authority/approval/enforcement separation | Active | mature adoption의 initial human-readable data 생성에서 선택 |

## Standard Pipeline

| Stage | Enters When | Produces | Exit Gate |
| --- | --- | --- | --- |
| Adoption | 새 repository를 초기화하거나 mature repository에 harness를 안전하게 적용할 때 | ownership inventory, no-write plan, repository-local skill, policy candidates, repo-local View/quality handoff | project-owned/dirty state 보존, conflict human review, exact apply fence |
| Whole alignment | 전체 목표, 용어, 범위가 아직 흐릴 때 | `control-plane`, `ubiquitous-language`, 핵심 `design` | 전체 목표, 용어, 품질 축이 잠김 |
| Codex orientation | Codex가 repo에서 안전하게 작업해야 할 때 | `AGENTS.md`, Codex guide, readiness validator | agent entrypoint와 검증 명령이 일치함 |
| Source ingest | 새 source, transcript, report, article, dataset을 durable knowledge로 반영할 때 | `source_refs`, source summary, 관련 `design`/`guide`/`report` 갱신 | 원문 위치, 해석 surface, 충돌 여부가 연결됨 |
| Policy alignment | human policy 또는 조직 지침을 개발 방향으로 구체화할 때 | non-authoritative proposal, human decision, effective normative design, operational guide | proposal/effective가 분리되고 exact approval/rule version이 연결됨 |
| Scalable retrieval | corpus 규모, 의미 검색 miss, freshness 병목이 반복될 때 | source registry, hybrid projection, revision receipt, reconciliation | source-authoritative query와 visibility SLO가 검증됨 |
| Project issue | 사람이 첫 initiative owner를 발급하거나 사람 승인 하에 예외 조건이 명확할 때 | main-issued umbrella `project` 또는 exception branch `project` draft commit | lineage / scope / out-of-scope / WBS / whole-system anchor 고정 |
| Task issue | 기존 umbrella 아래에서 실제로 닫을 수 있는 execution slice가 생길 때 | main-issued `task` draft commit | goal inventory / task placement / handoff / quality axes 고정 |
| Execute | 구현, 검증, 운영 정렬이 진행될 때 | current checkpoint, attention/decision/verification receipt, evidence delta, append-only milestone | execution barrier와 closeout gate 통과 |
| Wiki lint | 큰 ingest 후 또는 주기적으로 stale/drift를 점검할 때 | property 정리, missing cross-reference, stale claim 수정 제안 | active index, properties, current truth가 다시 맞음 |
| Closeout | 문서를 닫을 수 있을 때 | `done` 상태와 append-only closeout evidence | goal verification 전부 `Done` |

## Quality Axes

- 기본 품질 축은 `docs/guide/quality-axes.md`를 따릅니다.
- 새 프로젝트는 여기서 active axis를 선택하고, 각 `project`와 `task`에서 어떤 axis를 직접 책임지는지 적습니다.

## Required Validators

- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-harness-adoption.sh`
- `./docs/bin/validate-codex-readiness.sh`
- `./docs/bin/validate-doc-retrieval.sh`
- `./docs/bin/validate-execution-loop.sh --all`
- `./docs/bin/validate-closeout.sh --all`
- 필요하면 프로젝트별 build / test / smoke validator를 추가합니다.

## Handoff Rules

- `design`은 전체 truth를 잠그고 `project`와 `task`가 이를 읽습니다.
- human policy와 effective normative standard는 `design`이 소유하고, AI proposal `report`는 human approval 전까지 authority가 없습니다.
- task/QA는 proposal이 아니라 exact effective rule version을 참조하며 exception은 scope/expiry/risk acceptor를 별도로 보존합니다.
- `AGENTS.md`는 Codex가 즉시 읽는 instruction surface이고, 상세 규칙은 `docs/guide`로 넘깁니다.
- `operate-document-harness`는 repository-local router이며 user-global skill, human authority 또는 deterministic validator를 대체하지 않습니다.
- raw source는 불변 입력으로 두고, 생성 문서는 `source_refs`와 본문 참조로 연결합니다.
- `project`는 delivery boundary를 잠그고, `task`로 분해해 부분 실행을 통제합니다.
- umbrella `project`는 lineage의 기본 owner를 유지하고, 예외 branch `project`가 생겨도 먼저 설명합니다.
- `task`는 증빙과 handoff를 남기고 다음 `task`, `project`, downstream 시스템으로 넘깁니다.
- loop-enabled task는 current checkpoint를 resume surface로 사용하고 `Status`는 append-only milestone history로 유지합니다.
- local human view는 source path/revision/freshness를 보이는 derived projection이며 task, approval, evidence를 자체 truth로 소유하지 않습니다.
- mature repository migration은 target project-owned surface와 dirty bytes를 보존하고, exact no-write plan/ownership fence 없이 public harness 파일을 overwrite하지 않습니다.
- `report`는 시점성 정리를 담되, 재사용 가치가 생기면 상위 surface로 승격합니다.
- retrieval index는 candidate projection이며, 방금 바뀌었거나 revision이 불확실한 source는 직접 읽고 오래된 hit를 mask합니다.

## Change Log

- 2026-04-14: starter control-plane 문서 생성.
- 2026-04-16: umbrella initiative policy와 active umbrella project surface 추가.
- 2026-05-01: project human issuance 규칙 추가.
- 2026-05-09: source-backed ingest, markdown properties, wiki lint surface 추가.
- 2026-05-09: Codex orientation surface와 readiness validator 추가.
- 2026-05-16: retrieval-plane design index, context loading playbook, `_indexes`, and `validate-doc-retrieval.sh` 추가.
- 2026-06-14: `project`/`task` 번호 발급을 main-issued draft commit으로 고정.
- 2026-07-15: scalable retrieval plane, machine-readable policy, same-session source fallback을 active control surface에 추가.
- 2026-07-15: human-governed policy-to-evidence와 observable execution loop, read-only human view control surface를 추가.
- 2026-07-15: ownership-aware harness adoption, repository policy extraction, repo-local View/quality handoff를 active control surface에 추가.
- 2026-07-16: repository-local `operate-document-harness` canonical skill과 thin Claude adapter를 Codex/adoption control surface에 추가.
- 2026-07-16: executable adoption v1 lifecycle, machine-readable schemas/release manifest, fail-closed statuses와 versioned reference View를 active control surface에 정렬.
