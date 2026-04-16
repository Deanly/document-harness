# umbrella-project-governance

- Type: guide
- Created: 2026-04-16
- Updated: 2026-04-16

## Purpose

이 문서는 human이 인식하는 하나의 initiative를 기본적으로 umbrella project 1개로 유지하고, 하위 실행은 그 umbrella 아래 `task`로 분해하는 규칙을 고정합니다.

하네스가 bounded를 잘 강조하더라도, 이 규칙이 약하면 에이전트가 작은 분화마다 새 `project`를 발급해 human-facing lineage를 깨뜨릴 수 있습니다.

## Core Rule

- human이 보는 하나의 product, initiative, workstream은 기본적으로 umbrella project 1개로 유지합니다.
- 실제 실행 단위는 umbrella project 아래의 bounded `task`로 관리합니다.
- `task`로 수용 가능한 작업을 새 `project`로 분리하지 않습니다.

## Task-First Project Issuance Rule

새 work가 생기면 아래 순서로 판단합니다.

1. 기존 umbrella project의 새 `task`로 처리 가능한가
2. 기존 umbrella project WBS와 status history 안에서 설명 가능한가
3. human이 봤을 때 같은 initiative의 일부로 읽히는가

셋 중 대부분이 `yes`면 새 `project`가 아니라 새 `task`입니다.

## Allowed Exceptions

아래 조건 중 하나가 명확할 때만 새 `project`를 허용합니다.

- 사용자가 명시적으로 별도 project 분리를 요청한 경우
- completion mode가 본질적으로 달라 기존 umbrella project 아래 task로 담기 어려운 경우
- owner, 운영 검증 체계, handoff 대상이 실질적으로 분리되는 경우

이 셋이 없다면 기본값은 새 `task`입니다.

## Required Issuance Record

에이전트가 새 `project`가 필요하다고 판단하면 발급 전에 아래 두 문장을 남깁니다.

- 왜 기존 umbrella project의 `task`로 처리하면 안 되는지
- 왜 human 입장에서 별도 `project`가 더 이해하기 쉬운지

이 기록은 `Project Issuance Check` 섹션에 남깁니다.

## Execution Start Rule

구현을 시작하기 전에 아래 세 문장을 먼저 정렬합니다.

- active umbrella `project`가 무엇인지
- active `task`가 무엇인지
- 이번 작업이 왜 새 `project`가 아니라 해당 umbrella 아래 `task`인지

이 세 문장이 없다면 task 경계보다 project 발급이 먼저 튀어나오기 쉽습니다.

## Umbrella Lineage Rule

- umbrella project는 전체 lineage와 현재 위치를 설명하는 human-facing owner입니다.
- 하위 `task`는 Codex가 실행하고 닫기 쉬운 bounded slice여야 합니다.
- README, control-plane, 관련 design에서는 항상 umbrella project를 먼저 보이게 유지합니다.
- 후속 분화가 생겨도 umbrella project의 WBS와 status history 안에서 먼저 설명합니다.
- single-task 성격의 작은 분화는 새 `project` 대신 새 `task`로 처리합니다.

## Template Rule

- `project`는 `Project Role`, `Umbrella Initiative`, `Parent Umbrella Project`, `Umbrella Lineage`, `Project Issuance Check`를 가집니다.
- `task`는 `Related Umbrella Project`, `Task Placement Check`를 가집니다.
- `Project Role`의 기본값은 `umbrella`입니다.
- 예외 분기 project라면 `Project Role: exception-branch`를 쓰고 parent umbrella를 반드시 적습니다.

## Closeout And Active Surface Rule

- active `projects/README.md`는 umbrella project를 먼저 보여주고, 예외 분기 project는 lineage 안에서 설명합니다.
- active `tasks/README.md`는 각 task가 어느 umbrella project에 속하는지 함께 보여주는 것이 좋습니다.
- 후속 분화가 생겨도 human-facing owner는 umbrella project입니다.

## Change Log

- 2026-04-16: umbrella project default, task-first issuance, exception rule 추가.
