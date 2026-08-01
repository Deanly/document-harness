---
type: architecture
title: control-plane
status: current
domain: control-plane
owner:
created: 2026-04-14
updated: 2026-08-01
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
  - docs/architecture
  - control-plane
---

# control-plane

- Type: design
- Domain: control-plane
- Owner:
- Created: 2026-04-14
- Updated: 2026-08-01
- Referenced By:
  - `docs/README.md`

## Purpose

이 문서는 전체 시스템 목표, 표준 pipeline, active control surface, quality axis, validator를 한 곳에 모아 두는 central control surface입니다.

`design`이 전체를 놓치지 않게 만드는 장치라면, 이 문서는 그 `design` 문서들 사이의 상위 정렬면입니다. 새 `initiative`, `project`, `task`는 이 문서를 whole-system anchor로 참조하며, strategy/portfolio owner는 별도 `initiative`, delivery owner는 `project`, 실행 owner는 `task`로 분리합니다.

## Whole-System Outcome

- 이 저장소가 어떤 개발 목표를 끝까지 추적해야 하는지 적습니다.
- 시스템 규모와 코드 규모가 커져도 무엇을 전체 truth로 유지해야 하는지 적습니다.
- 부분 작업 문서가 무엇을 절대 잃어버리면 안 되는지 적습니다.

## Control Surfaces

### Whole-System Control

- `docs/architecture/control-plane.md`
- `docs/architecture/harness-language.md`
- root `AGENTS.md`
- 현재 시스템 경계를 정의하는 핵심 `design` 문서

### Focused Execution

- active `initiative`가 선택한 portfolio outcome
- initiative에 연결된 active bounded `project`
- active `task`
- WBS와 gate가 있는 실행 문서

### Human Governance

- `docs/governance/policy-to-evidence.md`
- `docs/architecture/harness-adoption-plane.md`
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
- `./docs/bin/validate-domain-design.sh --all`
- `./docs/bin/validate-domain-lineage.sh --all`
- `./docs/bin/validate-domain-supervision.sh --all`
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
- `docs/architecture/retrieval-plane.md` as the scalable retrieval and freshness contract

## Active Design Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/architecture/control-plane.md` | 전체 목표, pipeline, validator 정렬 | Active | |
| `docs/architecture/retrieval-plane.md` | hybrid 검색, revision, freshness, 복구 계약 | Active | 규모/freshness trigger가 있을 때 선택 |
| `docs/governance/policy-to-evidence.md` | human policy, AI proposal, approval, exception, evidence traceability | Active | governance-sensitive work에서 선택 |
| `docs/governance/initiative-governance.md` | policy/guideline → 추진안 → project/task hierarchy, approval, legacy bridge | Active | initiative authoring, project linkage, umbrella migration에서 선택 |
| `docs/architecture/execution-loop-plane.md` | checkpoint, attention, stop/resume, evidence barrier | Active | loop-enabled task 실행에서 선택 |
| `docs/architecture/human-control-view-plane.md` | projector, snapshot API/SSE, freshness, read-only security/runtime | Active | human view runtime 설계에서 선택 |
| `docs/architecture/harness-adoption-plane.md` | executable ownership-aware initialize/migrate/upgrade/verify/rollback, policy extraction, versioned repo-local View/quality handoff | Active | public v1 CLI/schema/release/status contract; existing repository adoption에서 선택 |
| `docs/architecture/harness-language.md` | canonical term 정렬 | Active | |
| `docs/guide/ddd-domain-design.md` | AI Domain Expert 최고 감독 권한, exact model/implementation review, Board decision package | Active | domain boundary 정의, 구현 정렬, 사용자 판단과 closeout에서 선택 |
| `docs/design/<domain>.md` | 현재 시스템 경계와 계약 | Add | 필요한 도메인 설계를 추가합니다. |

## Initiative Portfolio Policy

- 사용자 화면과 대화에서는 initiative를 `추진안`, source/schema에서는 `initiative`, stable ID에서는 `I####`로 부릅니다.
- 추진안은 policy와 guideline에 모두 직접 연결하며, policy는 WHY/WHAT, guideline은 HOW/EVIDENCE를 제공합니다.
- 새 추진안은 사람이 exact issuance를 승인한 뒤에만 clean, up-to-date `main`에서 발급합니다.
- activation은 issuance와 별도 gate이며 `approval_status: approved`, exact `approval_ref`, `status: active`가 함께 필요합니다.
- 하나의 추진안은 여러 bounded project를 연결할 수 있고, project는 기본적으로 한 개의 canonical `related_initiative`를 가집니다.
- 새 work는 먼저 현재 project 아래 새 task로 수용 가능한지 검토하고, 별도 delivery boundary일 때만 사람 승인 아래 새 project를 발급합니다.

## Active Initiatives

| Initiative | Outcome | Approval / Status | Linked Projects | Notes |
| --- | --- | --- | --- | --- |
| `docs/initiatives/<I0001-slug>.md` | portfolio outcome | Add | project source에서 reverse-index | active 추진안을 여기에 적습니다. |

## Active Delivery Projects

| Project | Initiative Ref | Status | Notes |
| --- | --- | --- | --- |
| `docs/projects/<P0001-slug>.md` | `I0001` | Add | bounded delivery project를 여기에 적습니다. |

## Legacy Umbrella Project Bridge

- `related_initiative`가 없는 기존 umbrella project와 `related_project`가 없는 기존 task의 legacy lineage는 migration 전까지 유효합니다.
- legacy `umbrella_initiative` 문자열을 승인된 `I####`로 자동 승격하지 않습니다.
- migration은 candidate 작성, policy/guideline 관계 정돈, human issuance/activation approval, ref 보강 순서로 진행합니다.
- modern ref가 추가되면 `related_initiative`가 canonical lineage이며 legacy field는 compatibility metadata입니다.

## Active Execution Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/ADOPT.md` | new/mature/versioned repository adoption orchestration | Active | `harness-adopt plan|apply|verify|rollback`; migration은 target 밖 no-write plan과 ownership fence부터 시작 |
| `.agents/skills/operate-document-harness/SKILL.md` | repository-local adoption/execution/policy/`Board` workflow router | Active | user-global install 없이 durable repository entrypoint로 위임 |
| `docs/EXECUTE.md` | loop-enabled task 시작·재개·중단·closeout orchestration | Active | current task/checkpoint와 exact authority refs 앞에서 읽는 실행 진입점 |
| `docs/initiatives/README.md` | active 추진안 입구 | Active | outcome, approval, owner와 project linkage가 먼저 보여야 합니다. |
| `docs/projects/README.md` | active delivery project 입구 | Active | 각 project의 initiative ref가 보여야 합니다. |
| `docs/tasks/README.md` | active task 입구 | Active | 각 task의 project와 그 Project를 통한 initiative 계보가 드러나야 합니다. |
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
| Initiative issue | 정책·지침을 portfolio outcome과 project 방향으로 연결할 때 | human-approved main-issued `I####` draft와 activation review | policy/guideline direct links, success signals, issuance/activation refs 고정 |
| Scalable retrieval | corpus 규모, 의미 검색 miss, freshness 병목이 반복될 때 | source registry, hybrid projection, revision receipt, reconciliation | source-authoritative query와 visibility SLO가 검증됨 |
| Project issue | 승인된 추진안 안에 별도 bounded delivery가 필요할 때 | `related_initiative`가 있는 main-issued `project` draft commit | initiative alignment / scope / out-of-scope / WBS / whole-system anchor 고정 |
| Task issue | project 아래에서 실제로 닫을 수 있는 execution slice가 생길 때 | `related_project`를 통해 추진안 계보를 따르는 main-issued `task` draft commit | goal inventory / task placement / handoff / quality axes 고정 |
| Domain supervision | delivery boundary를 정하거나 의미 있는 code/DB/API/event/test bytes가 바뀔 때 | AI Domain Expert exact review, Board 선택지·engineering 권고, 필요한 human decision receipt | `aligned` 또는 만료가 있는 human-accepted temporary deviation; 코드/모델 변경 선택은 후속 `aligned` review 필요 |
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
- `./docs/bin/validate-domain-design.sh --all`
- `./docs/bin/validate-domain-lineage.sh --all`
- `./docs/bin/validate-domain-supervision.sh --all`
- `./docs/bin/validate-execution-loop.sh --all`
- `./docs/bin/validate-closeout.sh --all`
- 필요하면 프로젝트별 build / test / smoke validator를 추가합니다.

## Handoff Rules

- `design`은 전체 truth를 잠그고 `project`와 `task`가 이를 읽습니다.
- human policy와 effective normative standard는 `design`이 소유하고, AI proposal `report`는 human approval 전까지 authority가 없습니다.
- task/QA는 proposal이 아니라 exact effective rule version을 참조하며 exception은 scope/expiry/risk acceptor를 별도로 보존합니다.
- `AGENTS.md`는 Codex가 즉시 읽는 instruction surface이고, 상세 규칙은 `docs/guide`로 넘깁니다.
- `operate-document-harness`는 repository-local router이며 user-global skill, human authority 또는 deterministic validator를 대체하지 않습니다.
- AI Domain Expert는 사람 바로 아래의 최고 감독 권한으로 모든 delivery 역할을 challenge하고 unresolved domain meaning을 중단시킬 수 있지만 material/strategic 결정이나 위험 수용을 대신하지 않습니다.
- raw source는 불변 입력으로 두고, 생성 문서는 `source_refs`와 본문 참조로 연결합니다.
- `initiative`는 policy/guideline 방향과 portfolio outcome을 잠그고, `project`는 bounded delivery를, `task`는 실행을 통제합니다.
- View의 initiative→project 연결은 project source의 `related_initiative`를 reverse-index한 projection이며 별도 truth를 만들지 않습니다.
- legacy umbrella project는 migration 전까지 보존하지만 새 authoring model의 strategy owner로 사용하지 않습니다.
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
- 2026-07-18: 별도 추진안 계층, policy/guideline direct relation, initiative→project→task hierarchy와 legacy umbrella bridge를 active control surface에 정렬.
- 2026-08-01: AI Domain Expert를 사람 바로 아래의 최고 감독 권한으로 두고 exact model·implementation review, Board decision package와 closeout blocker를 active control surface에 정렬.
