---
type: guide
title: llm-wiki-operations
status: current
owner:
created: 2026-05-09
updated: 2026-05-09
related_project: []
related_task: []
related_design:
  - docs/design/control-plane.md
source_refs: []
tags:
  - docs/guide
---

# llm-wiki-operations

- Type: guide
- Created: 2026-05-09
- Updated: 2026-05-09
- Related Project:
- Related Task:
- Related Design: docs/design/control-plane.md

## Purpose

이 문서는 LLM이 문서를 일회성 RAG 답변처럼 다시 조립하지 않고, 누적되는 wiki surface로 유지하기 위한 운영 규칙을 고정합니다.

이 하네스의 `design`, `project`, `task`, `guide`, `report`는 이미 persistent artifact 역할을 합니다. 이 문서는 거기에 raw source layer, ingest/query/lint loop, markdown properties를 더해 Obsidian/Dataview와 에이전트가 같은 구조를 읽게 만듭니다.

## Fit To This Harness

- `docs/design`은 현재 truth와 canonical synthesis를 담습니다.
- `docs/guide`는 반복되는 판단과 운영 규칙을 축적합니다.
- `docs/project`와 `docs/task`는 실행 이력과 evidence를 append-only로 남깁니다.
- `docs/reports`는 특정 질문에 대한 시점성 답변을 담고, 재사용 가치가 생기면 `guide`, `design`, `project`, `task`로 승격합니다.
- `AGENTS.md`는 Codex가 wiki surface를 안전하게 수정하기 전에 읽는 짧은 instruction surface입니다.
- 폴더 `README.md`는 작은 규모의 index입니다. 문서 수가 커지면 검색 도구를 추가하되, 먼저 README와 properties가 정확해야 합니다.

## Source Layer

- raw source는 가능한 한 불변으로 둡니다. 원문 파일을 고치기보다 새 source를 추가하거나 별도 note/report에서 해석합니다.
- 프로젝트가 raw source를 많이 다루면 `raw/`, `sources/`, 또는 팀이 정한 source directory를 하나 고정합니다.
- 생성 문서에는 `source_refs` property와 본문 `References` 또는 `Inputs` 섹션으로 raw source를 연결합니다.
- 이미지, PDF, CSV처럼 markdown 본문에서 바로 읽기 어려운 source는 파일 경로와 관찰한 내용을 함께 남깁니다.

## Ingest Workflow

새 source가 들어오면 아래 순서로 처리합니다.

1. raw source의 위치와 변경 금지 여부를 확인합니다.
2. source에서 사실, 주장, 용어, 결정, 충돌 가능성을 추출합니다.
3. 필요하면 `report`로 source summary를 남깁니다.
4. 새 정보가 현재 truth를 바꾸면 관련 `design`을 먼저 갱신합니다.
5. 반복 규칙이나 사용법이 생기면 `guide`를 갱신합니다.
6. 실행 범위나 evidence가 바뀌면 관련 `project`와 `task`를 갱신합니다.
7. 관련 문서의 `source_refs`, `updated`, 관계 properties, 폴더 README를 같은 변경 셋에서 갱신합니다.

## Query Workflow

질문을 받으면 먼저 active entry point와 properties를 읽고, 필요한 문서만 좁혀서 답합니다.

- 답이 일회성이면 대화로만 끝낼 수 있습니다.
- 답이 비교표, 기준, 의사결정, 운영 순서처럼 재사용될 값이면 `report`나 `guide`로 파일링합니다.
- 답이 현재 시스템 truth를 바꾸면 `design`과 `control-plane`을 우선 갱신합니다.
- 답변에 사용한 source나 근거 문서는 `source_refs`, `References`, `Inputs`에 남깁니다.

## Lint Workflow

정기적으로 또는 큰 ingest 후에 wiki health-check를 수행합니다.

- folder README의 active 목록과 각 문서 `status`가 일치하는지 봅니다.
- root `AGENTS.md`가 현재 validator, template, 핵심 guide를 가리키는지 봅니다.
- properties와 첫 화면 visible metadata가 일치하는지 봅니다.
- `source_refs`가 없는 주장성 문서가 있는지 봅니다.
- 새 핵심 용어가 `docs/design/ubiquitous-language.md`에 반영되었는지 봅니다.
- `design`의 current truth와 `guide`, `project`, `task`의 오래된 설명이 충돌하지 않는지 봅니다.
- inbound link가 없는 중요한 문서, 또는 반복 언급되지만 독립 문서가 없는 개념을 찾습니다.

## Index And Log Mapping

- `index.md` 역할은 현재 각 폴더 `README.md`와 `docs/design/control-plane.md`의 active surface 표가 맡습니다.
- `log.md` 역할은 `task`/`project`의 append-only `Status`, `design`/`guide`의 `Change Log`, `report`의 `Status`가 맡습니다.
- 문서 수가 늘어나면 별도 `docs/index.md`나 검색 도구를 추가할 수 있지만, 먼저 각 문서의 properties와 README가 정확해야 합니다.

## Properties Contract

- YAML frontmatter는 query/index/Dataview용 machine-readable surface입니다.
- 첫 화면 bullet metadata는 사람이 빠르게 읽는 mirror입니다.
- `type`, `status`, `owner`, `created`, `updated`, 관계 property는 가능한 한 모든 새 문서에 둡니다.
- `project`와 `task`는 `doc_id`, `completion_mode`, control-plane 관계 property를 둡니다.
- source 기반 문서는 `source_refs`를 둡니다.
- 새 property key가 필요하면 템플릿과 이 가이드를 함께 갱신합니다.

## Change Log

- 2026-05-09: LLM Wiki 방식의 source-backed ingest/query/lint loop와 properties contract 추가.
- 2026-05-09: root AGENTS.md를 wiki surface 수정 전 Codex instruction surface로 반영.
