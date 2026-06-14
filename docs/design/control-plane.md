---
type: design
title: control-plane
status: current
domain: control-plane
owner:
created: 2026-04-14
updated: 2026-06-14
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
- Updated: 2026-06-14
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

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `./docs/bin/new-doc.sh`
- `docs/guide/quality-axes.md`
- YAML frontmatter properties
- `source_refs`
- `./docs/bin/validate-codex-readiness.sh`
- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-doc-retrieval.sh`
- `./docs/bin/validate-closeout.sh`

### Codex Agent Control

- root `AGENTS.md`
- `docs/_templates/agents.md`
- `docs/guide/codex-agent-guidance.md`
- `docs/bin/validate-codex-readiness.sh`

### Source-Backed Knowledge

- project-specific immutable `raw/` or `sources/` directory
- generated markdown surfaces with `source_refs`
- folder README files as lightweight indexes
- `Status` and `Change Log` sections as chronological logs

## Active Design Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/design/control-plane.md` | 전체 목표, pipeline, validator 정렬 | Active | |
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
| `docs/projects/README.md` | active umbrella-first project 입구 | Active | lineage가 먼저 보여야 합니다. |
| `docs/tasks/README.md` | active task 입구 | Active | 각 task의 umbrella owner가 드러나야 합니다. |
| `docs/reports/README.md` | active report 입구 | Active | |
| `docs/design/README.md` | design retrieval 입구 | Active | design corpus selection index |
| `docs/_indexes/active-docs.md` | active docs retrieval index | Active | README active surface와 함께 유지합니다. |
| `docs/_indexes/design-map.md` | compact design retrieval map | Active | `docs/design/README.md`에서 파생됩니다. |
| `docs/_indexes/context-packets.yaml` | context packet manifest | Active | default broad-load guard 대상입니다. |
| `docs/guide/context-loading-playbooks.md` | work-type context loading rules | Active | Codex/LLM context-window 선택 기준 |

## Standard Pipeline

| Stage | Enters When | Produces | Exit Gate |
| --- | --- | --- | --- |
| Whole alignment | 전체 목표, 용어, 범위가 아직 흐릴 때 | `control-plane`, `ubiquitous-language`, 핵심 `design` | 전체 목표, 용어, 품질 축이 잠김 |
| Codex orientation | Codex가 repo에서 안전하게 작업해야 할 때 | `AGENTS.md`, Codex guide, readiness validator | agent entrypoint와 검증 명령이 일치함 |
| Source ingest | 새 source, transcript, report, article, dataset을 durable knowledge로 반영할 때 | `source_refs`, source summary, 관련 `design`/`guide`/`report` 갱신 | 원문 위치, 해석 surface, 충돌 여부가 연결됨 |
| Project issue | 사람이 첫 initiative owner를 발급하거나 사람 승인 하에 예외 조건이 명확할 때 | main-issued umbrella `project` 또는 exception branch `project` draft commit | lineage / scope / out-of-scope / WBS / whole-system anchor 고정 |
| Task issue | 기존 umbrella 아래에서 실제로 닫을 수 있는 execution slice가 생길 때 | main-issued `task` draft commit | goal inventory / task placement / handoff / quality axes 고정 |
| Execute | 구현, 검증, 운영 정렬이 진행될 때 | evidence, 상태 이력, 필요 시 guide/report | closeout gate 통과 |
| Wiki lint | 큰 ingest 후 또는 주기적으로 stale/drift를 점검할 때 | property 정리, missing cross-reference, stale claim 수정 제안 | active index, properties, current truth가 다시 맞음 |
| Closeout | 문서를 닫을 수 있을 때 | `done` 상태와 append-only closeout evidence | goal verification 전부 `Done` |

## Quality Axes

- 기본 품질 축은 `docs/guide/quality-axes.md`를 따릅니다.
- 새 프로젝트는 여기서 active axis를 선택하고, 각 `project`와 `task`에서 어떤 axis를 직접 책임지는지 적습니다.

## Required Validators

- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-codex-readiness.sh`
- `./docs/bin/validate-doc-retrieval.sh`
- `./docs/bin/validate-closeout.sh --all`
- 필요하면 프로젝트별 build / test / smoke validator를 추가합니다.

## Handoff Rules

- `design`은 전체 truth를 잠그고 `project`와 `task`가 이를 읽습니다.
- `AGENTS.md`는 Codex가 즉시 읽는 instruction surface이고, 상세 규칙은 `docs/guide`로 넘깁니다.
- raw source는 불변 입력으로 두고, 생성 문서는 `source_refs`와 본문 참조로 연결합니다.
- `project`는 delivery boundary를 잠그고, `task`로 분해해 부분 실행을 통제합니다.
- umbrella `project`는 lineage의 기본 owner를 유지하고, 예외 branch `project`가 생겨도 먼저 설명합니다.
- `task`는 증빙과 handoff를 남기고 다음 `task`, `project`, downstream 시스템으로 넘깁니다.
- `report`는 시점성 정리를 담되, 재사용 가치가 생기면 상위 surface로 승격합니다.

## Change Log

- 2026-04-14: starter control-plane 문서 생성.
- 2026-04-16: umbrella initiative policy와 active umbrella project surface 추가.
- 2026-05-01: project human issuance 규칙 추가.
- 2026-05-09: source-backed ingest, markdown properties, wiki lint surface 추가.
- 2026-05-09: Codex orientation surface와 readiness validator 추가.
- 2026-05-16: retrieval-plane design index, context loading playbook, `_indexes`, and `validate-doc-retrieval.sh` 추가.
- 2026-06-14: `project`/`task` 번호 발급을 main-issued draft commit으로 고정.
