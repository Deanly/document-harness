# {{DOC_ID}} {{TITLE}}

- Type: project
- Document ID: {{DOC_ID}}
- Status: draft
- Completion Mode: functional
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}
- Current Focus:
- Related Design:

## Purpose

이 프로젝트의 목적과 기대 결과를 적습니다.

## Committed Outcome

- 이 project가 `done`일 때 실제로 새로 가능해져야 하는 기능, 운영 기준, delivery boundary를 적습니다.
- 예외적으로 설계만 닫는 project라면 `Completion Mode: design-only`와 그 이유를 명시합니다.

## Scope

- 포함 범위
- 직접 책임지는 delivery boundary

## Out Of Scope

- 후속 프로젝트나 다른 시스템의 책임
- 이번 project에서 고정하지 않을 범위

## References

- 관련 설계 문서
- 상위 요구사항
- 관련 task / guide / report

## WBS

| ID | Work Item | Status | Progress | Notes |
| --- | --- | --- | --- | --- |
| T0001 | Example task title | Todo | 0% | project WBS rows should map 1:1 to task docs |
| T0002 | Example task title | Todo | 0% | use task document IDs as project WBS IDs |

## Planned Task Candidates

- 아직 task 문서를 발급하지 않았다면 후보만 적습니다.

## Overall Progress

- 0%

## Milestones

- 없음

## Exit Criteria

1. project 목적에 적은 delivery boundary가 실제로 닫혔음을 검증할 수 있습니다.
2. 필수 `task`가 모두 `done`이거나, 범위 재발급 근거와 함께 `superseded` 또는 `cancelled`로 정리되어 있습니다.
3. 남은 범위가 있다면 후속 project로 명시되며, 현재 project의 원래 목적을 축소한 `done` 처리로 위장하지 않습니다.

## Completion Guardrails

- 기존 Purpose를 더 작은 하위 조각으로 축소해 `done` 처리하지 않습니다.
- 남은 핵심 목표를 후속 project나 task로 넘겼다면 이 project는 `done`이 아니라 `active`, `blocked`, `superseded`, `cancelled` 중 하나여야 합니다.
- `Completion Mode: design-only`가 아니라면 설계 문서 작성만으로 닫지 않습니다.

## Status

- {{DATE}}: project 문서 생성.
