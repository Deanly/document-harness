# {{DOC_ID}} {{TITLE}}

- Type: task
- Document ID: {{DOC_ID}}
- Status: draft
- Completion Mode: functional
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}
- Current Focus:
- Related Project:
- Related Design:

## Purpose

이 task가 해결하려는 목적을 적습니다.

## Committed Outcome

- 이 task가 `done`일 때 실제로 새로 가능해져야 하는 기능 또는 실행 경계를 적습니다.
- 예외적으로 설계만 닫는 task라면 `Completion Mode: design-only`와 잠기는 설계 산출물을 적습니다.

## Scope

- 이 task가 포함하는 작업
- 직접 닫을 수 있는 기능 또는 실행 경계

## Out Of Scope

- 이 task가 포함하지 않는 작업
- 후속 task나 다른 시스템의 책임

## References

- 관련 프로젝트 문서
- 관련 설계 문서
- 관련 이슈, PR, 외부 문서

## Dependencies

- 선행 task 또는 선행 조건

## WBS

| ID | Work Item | Status | Progress | Notes |
| --- | --- | --- | --- | --- |
| W1 | Define work breakdown | Todo | 0% | |
| W2 | Execute implementation | Todo | 0% | |
| W3 | Verify and close | Todo | 0% | |

## Overall Progress

- 0%

## Completion Criteria

1. 검증 가능한 종료 조건을 적습니다.
2. 가능하면 실제 실행, 증적, 상태 변화 관점으로 씁니다.

## Completion Guardrails

- 기존 Purpose를 더 작은 하위 조각으로 축소해 `done` 처리하지 않습니다.
- 남은 핵심 목표를 후속 task나 project로 넘겼다면 이 task는 `done`이 아니라 `active`, `blocked`, `superseded`, `cancelled` 중 하나여야 합니다.
- `Completion Mode: design-only`가 아니라면 설계 문서 작성만으로 닫지 않습니다.

## Risks / Open Questions

- 없음

## Status

- {{DATE}}: task 문서 생성.
