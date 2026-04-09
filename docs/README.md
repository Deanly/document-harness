# Docs Harness

이 디렉터리는 프로젝트의 문서를 "현재 truth"와 "실행 이력"으로 분리해서 관리하기 위한 하네스입니다.

좋은 문서의 기준은 아래와 같습니다.

- 설계 문서는 지금 기준의 진실값을 담습니다.
- `task`와 `project`는 append-only 상태 이력을 남깁니다.
- `guide`는 반복되는 판단을 재사용 가능한 규칙으로 압축합니다.
- 모든 문서는 서로를 명시적으로 참조합니다.
- 문서는 구현을 따라가는 보고서가 아니라, 구현과 운영을 정렬시키는 인터페이스입니다.

## Directory Layout

- `docs/tasks/`: 작업 단위 문서
- `docs/projects/`: 프로젝트 단위 문서
- `docs/design/`: 도메인, 경계, 계약, 정책 설계 문서
- `docs/guide/`: 반복적으로 참조하는 운영/구현/판단 가이드
- `docs/reports/`: 요청성 보고 문서
- `docs/examples/`: 완성형 샘플 문서
- `docs/_templates/`: 문서 템플릿
- `docs/bin/`: 문서 생성 도구

## Harness Philosophy

- boundary-first: 구현보다 먼저 책임 경계와 비범위를 고정합니다.
- evidence-backed: 완료, 위험, 운영 판단은 실제 관찰 결과와 연결합니다.
- current-truth design: 설계 문서는 append-only 이력보다 현재 기준의 정확성을 우선합니다.
- append-only execution history: `task`와 `project`의 `Status`는 실행 이력을 시간순으로 누적합니다.
- narrow scope: v1 범위를 명시적으로 좁게 고정하고, 후속 경계를 별도 프로젝트로 분리합니다.
- ubiquitous language: 핵심 용어는 한 곳에서 canonical term을 고정하고 설계 변경과 함께 갱신합니다.

자세한 분석은 `docs/guide/harness-philosophy.md`를 봅니다.

## Document Types

### Task

- 파일명 규칙: `T0001-abc.md`
- prefix: `T`
- 의미: 실제로 수행하고 닫을 수 있는 작업 단위
- 필수 내용:
  - 목적
  - 범위
  - 비범위
  - 관련 문서 참조
  - dependencies
  - 내부 WBS
  - 전체 진행률
  - completion criteria
  - append-only `Status`

### Project

- 파일명 규칙: `P0001-abc.md`
- prefix: `P`
- 의미: 하나의 bounded delivery/project 단위
- 필수 내용:
  - 목적
  - 범위와 비범위
  - 관련 문서 참조
  - 프로젝트 WBS
  - 전체 진행률
  - milestones
  - append-only `Status`

### Design

- 파일명 규칙: `domain-boundary.md`
- 의미: 시스템 설계, 모델, 계약, 정책의 기준 문서
- 특징:
  - 현재 truth를 우선합니다.
  - 필요 시 지속 수정합니다.
  - 설계가 바뀌면 관련 `task`, `project`, `guide`보다 먼저 갱신합니다.

### Guide

- 파일명 규칙: `topic-guide.md`, `topic-qna.md`, `topic-baseline.md`
- 의미: 실무형 설명, 운영 기준, Q&A, 실행 순서, 체크리스트
- 특징:
  - 설계 문서보다 설명적입니다.
  - 요청성 보고보다 지속적으로 재사용됩니다.
  - project/task/design의 의사결정을 보조합니다.

### Report

- 파일명 규칙: `report-topic.md`
- 의미: 요청에 의해 생성되는 시점성 보고 문서
- 특징:
  - 고정 번호 체계는 강제하지 않습니다.
  - 요청 목적에 맞는 구조를 사용합니다.

### Ubiquitous Language

- 권장 파일: `docs/design/ubiquitous-language.md`
- 의미: 프로젝트 전체에서 쓰는 canonical term 사전
- 특징:
  - 설계 변경과 같은 변경 셋에서 갱신합니다.
  - 같은 대상을 가리키는 복수 표현이 생기면 하나의 term으로 고정합니다.

## Issuing Rules

- `task`와 `project`는 독립된 번호 시퀀스를 가집니다.
- 번호는 중앙 카운터 파일 없이 기존 파일을 스캔해 계산합니다.
- 번호는 4자리 고정입니다.
- slug는 공백 대신 hyphen을 사용하는 kebab-case를 기본으로 하며, 한글을 포함한 유니코드 문자도 허용합니다.
- 기존 문서를 삭제하지 않는 한 번호는 재사용하지 않습니다.
- `guide`, `design`, `report`는 번호보다 의미 있는 slug를 우선합니다.

## Update Rules

- `task`와 `project`의 `Status` 섹션은 append-only로 운영합니다.
- 새 이력은 문서 하단에 계속 추가합니다.
- WBS와 진행률은 현재 상태를 반영하도록 갱신합니다.
- `task`와 `project`는 관련 `design` 문서를 명시적으로 참조합니다.
- `project` 문서의 WBS는 실제 `task` 문서와 1:1로 대응하는 것을 기본 규칙으로 합니다.
- `project` 문서의 WBS `ID`는 해당 `task`의 문서 번호를 그대로 사용합니다.
- `task` 내부 WBS의 `ID`는 `W1`, `W2`, `W3` 형식을 사용합니다.
- 설계가 변경되면:
  - 먼저 `design` 문서를 수정합니다.
  - 새 핵심 용어, 상태, 경계가 생기면 `docs/design/ubiquitous-language.md`를 같은 변경 셋에서 함께 수정합니다.
  - 이후 관련 `task`, `project`, `guide`의 참조와 상태를 갱신합니다.

## Writing Bar

- Purpose는 "왜 이 문서가 존재하는가"를 첫 단락에서 바로 말해야 합니다.
- Scope와 Out Of Scope는 모두 씁니다. 좋은 문서는 포함 범위만이 아니라 제외 범위도 분명합니다.
- 실행 순서가 중요한 경우 Dependencies, Gates, Exit Criteria를 문서에 드러냅니다.
- 설계는 원칙이 아니라 계약과 규칙까지 고정합니다.
- Status는 "작업했다"가 아니라 "무엇을 고정했고 어떤 증빙이 있는가"를 적습니다.
- 구현 전 브레인스토밍과 실제 기준 문서를 섞지 않습니다.
- 아직 경계가 잠기지 않았다면 새 `project`보다 `guide`나 `design`으로 남기는 편이 낫습니다.
- placeholder를 그대로 남기지 않습니다. 시작이 필요하면 `docs/examples/`를 먼저 참고합니다.

## WBS Conventions

### Project WBS

- 한 행은 하나의 `task` 문서에 대응합니다.
- `ID`는 해당 task의 문서 번호를 그대로 사용합니다.
- `Work Item`은 task 제목 또는 대표 작업명을 사용합니다.
- `Notes`에는 해당 task의 핵심 목적이나 산출물을 적습니다.

### Task WBS

- task 내부 WBS는 그 task를 수행하기 위한 세부 작업입니다.
- 내부 `ID`는 `W1`, `W2`, `W3` 형식을 사용합니다.
- `T0001` 같은 문서 번호 형태를 task 내부 WBS ID로 사용하지 않습니다.

## Recommended Workflow

1. 프로젝트 시작 시 첫 `project` 문서를 발급합니다.
2. 핵심 boundary와 계약을 `design`으로 고정합니다.
3. `docs/design/ubiquitous-language.md`를 함께 갱신합니다.
4. 실제 작업 단위가 생기면 `task` 문서를 발급합니다.
5. 반복적으로 참조할 설명, 체크리스트, 운영 기준은 `guide`로 남깁니다.
6. 요청성 정리나 특정 시점 보고는 `report`로 남깁니다.

프로젝트 분할 규칙은 `docs/guide/project-cutting-and-execution.md`를 우선합니다.

## Commands

```bash
./docs/bin/new-doc.sh project example-runtime-boundary
./docs/bin/new-doc.sh task bootstrap-ingestion-worker
./docs/bin/new-doc.sh task "문서 하네스 정리"
./docs/bin/new-doc.sh design event-ingestion
./docs/bin/new-doc.sh guide project-cutting-and-execution
./docs/bin/new-doc.sh report sprint-01-status
```

## Starter Docs

- `docs/design/ubiquitous-language.md`
- `docs/guide/harness-philosophy.md`
- `docs/guide/project-cutting-and-execution.md`

## Examples

- `docs/examples/README.md`
