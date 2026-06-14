---
type: design
title: ubiquitous-language
status: current
domain: ubiquitous-language
owner:
created: 2026-04-10
updated: 2026-06-14
retrieval_class:
  - term-excerpt
context:
  default_load: false
  section_load: true
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/README.md
  - docs/design/control-plane.md
related_task:
  - docs/tasks/T0001-retrieval-plane-baseline.md
source_refs: []
tags:
  - docs/design
  - ubiquitous-language
---

# ubiquitous-language

- Type: design
- Domain: ubiquitous-language
- Owner:
- Created: 2026-04-10
- Updated: 2026-06-14
- Referenced By:
  - `docs/README.md`
  - `docs/design/control-plane.md`

## Purpose

이 문서는 현재 프로젝트에서 같은 대상을 같은 말로 부르기 위한 canonical term 기준입니다.

새로운 `design` 문서가 추가되거나 기존 설계에서 핵심 개념, 상태, 경계가 바뀌면 같은 변경 셋에서 이 문서도 함께 갱신합니다.

placeholder 대신 채워진 예시가 필요하면 `docs/examples/README.md`를 먼저 봅니다.

이 문서는 `docs/design/control-plane.md`와 함께 whole-system control surface를 이룹니다.

## Retrieval Rule

- 이 문서는 canonical term registry입니다.
- 일반 task/project execution에서 full document를 기본 로딩하지 않습니다.
- 용어 판단이 필요할 때 관련 heading 또는 term section만 section-load 합니다.
- terminology governance 또는 naming design 작업일 때만 전체 문서를 읽습니다.

## Maintenance Rule

- 새로운 design 문서가 추가될 때:
  - 새로운 핵심 명사, 상태, 책임, 경계가 생기면 이 문서에 추가합니다.
- 기존 design 문서가 변경될 때:
  - 용어의 의미나 범위가 바뀌면 이 문서를 함께 수정합니다.
- `task`, `project`, `guide`는 이 문서의 용어를 우선 사용합니다.
- 같은 대상을 가리키는 표현이 여러 개 생기면 canonical term 하나를 고정합니다.

## Core Boundary Terms

### `agent instruction surface`

Codex 같은 coding agent가 작업 전에 자동으로 읽는 짧은 repository guidance를 뜻합니다.

이 하네스에서는 루트 `AGENTS.md`가 기본 agent instruction surface입니다.

### `project-system-name`

이 프로젝트의 가장 바깥 시스템 이름을 적습니다.

예:

- 수집기
- API
- 배치 파이프라인

### `ingress`

외부 입력이 이 프로젝트 안으로 들어오는 입구를 뜻합니다.

### `core processing`

이 프로젝트가 직접 책임지는 핵심 처리 단계를 뜻합니다.

### `downstream`

이 프로젝트 이후에 결과를 받는 시스템을 뜻합니다.

## Runtime Terms

### `worker`

프로세스가 어떤 실행 모델로 동작하는지 적습니다.

예:

- one-shot worker
- long-running server
- scheduled batch

### `checkpoint`

다음 실행이나 다음 단계가 이전 상태를 이어받기 위해 저장하는 최소 진행 상태를 뜻합니다.

### `operator prerequisite`

운영 환경에서 사람이 먼저 준비해야 하는 전제를 뜻합니다.

예:

- 권한
- 인증 정보
- 외부 서비스 접근

## Domain Terms

### `raw source`

LLM이 해석하기 전의 원문 파일, clipping, transcript, image, PDF, dataset을 뜻합니다.

raw source는 가능한 한 불변으로 두고, 해석과 synthesis는 생성 문서에 남깁니다.

### `source ref`

생성 문서가 근거로 읽은 raw source나 외부 문서 경로를 뜻합니다.

markdown properties에서는 `source_refs` key를 사용합니다.

### `markdown properties`

문서 상단 YAML frontmatter에 적는 machine-readable metadata를 뜻합니다.

Obsidian, Dataview, 검색 도구, LLM agent가 문서를 분류하고 연결할 때 우선 읽는 index surface입니다.

### `wiki surface`

LLM이 유지하는 persistent markdown artifact를 뜻합니다.

이 하네스에서는 `design`, `guide`, `project`, `task`, `report`가 wiki surface입니다.

### `ingest`

새 source를 읽고, summary와 source_refs를 남기며, 관련 wiki surface의 current truth나 실행 이력을 갱신하는 작업을 뜻합니다.

### `lint pass`

문서의 stale claim, orphan, missing cross-reference, property drift, source gap을 점검하는 health-check 작업을 뜻합니다.

### `done criteria`

Codex 또는 사람이 작업을 닫기 전에 참이어야 하는 검증 가능한 완료 조건을 뜻합니다.

prompt에서는 `done when`으로 표현할 수 있고, 이 하네스에서는 `Completion Criteria`, `Exit Criteria`, `Goal Verification`, validator 결과로 구체화합니다.

### `main-issued draft`

`project` 또는 `task` 문서 번호를 `main`의 문서 집합 기준으로 예약하기 위해 clean, up-to-date `main`에서 생성하고 즉시 commit한 `draft` 문서를 뜻합니다.

main-issued draft는 active truth가 아니라 번호 reservation이며, work branch가 `main`을 merge한 뒤 내용을 채우고 필요할 때 active 전환합니다.

### `source record`

원문 기준으로 보존되는 가장 초기 데이터 단위를 적습니다.

### `normalized record`

정규화 규칙이 적용된 내부 canonical data를 적습니다.

### `result event`

downstream에 전달하거나 이후 단계가 소비하는 구조화 결과를 적습니다.

### `failure record`

실패를 버리지 않고 보존할 때 쓰는 canonical term을 적습니다.

## Out-Of-Scope Terms

### `future subsystem`

후속 `task` 또는 예외 branch `project`, 다른 별도 경계로 넘길 시스템을 적습니다.

### `final truth`

현재 프로젝트가 직접 확정하지 않는 최종 진실값이 있다면 그 term을 적습니다.

## Change Log

- 2026-04-10: 하네스 starter 문서 생성.
- 2026-04-14: control-plane과의 whole-system control surface 연결 규칙 추가.
- 2026-05-09: LLM Wiki 운영을 위한 raw source, source_refs, markdown properties, ingest/lint 용어 추가.
- 2026-05-09: Codex 운영을 위한 agent instruction surface와 done criteria 용어 추가.
- 2026-06-14: main-issued draft 용어 추가.
