# goal-locked-completion

- Type: guide
- Created: 2026-04-13
- Updated: 2026-04-13

## Purpose

이 문서는 AI나 사람이 기존 `project` 또는 `task`를 임의로 더 작은 조각으로 분할한 뒤, 원래 발급된 목표를 달성하지 않았는데도 `done`으로 닫아버리는 문제를 막기 위한 완료 무결성 규칙을 고정합니다.

## Core Rule

`project`와 `task`는 발급 시점의 목표를 기준으로 닫습니다.

- `Purpose`, `Scope`, `Out Of Scope`, `Completion Mode`, `Completion Criteria` 또는 `Exit Criteria`는 발급 시점의 계약입니다.
- 이후에 WBS를 더 잘게 쪼개거나 후속 문서를 발급해도, 기존 문서의 `done` 기준은 약해지지 않습니다.
- 원래 목표가 바뀌었다면 `done`이 아니라 `superseded` 또는 `cancelled`여야 합니다.

즉 "큰 목표를 작은 task로 나눴다"는 사실만으로 기존 항목을 완료 처리할 수 없습니다.

## Completion Modes

기본 `Completion Mode`는 `functional`입니다.

- `functional`: 하나의 기능 단위, 운영 경계, delivery boundary가 실제로 닫혀야 합니다.
- `design-only`: 예외적으로 설계 산출물 자체를 authoritative truth로 고정하는 경우만 허용합니다.

기본값을 벗어나야 한다면 문서 발급 시점에 먼저 적습니다. 발급 후에 `functional` 항목을 뒤늦게 `design-only`로 재해석하지 않습니다.

## Functional Unit Test

`Completion Mode: functional`인 항목은 아래 질문에 답할 수 있어야 합니다.

- `done`일 때 무엇이 새로 동작하는가
- 누가 그 결과를 관찰하거나 사용할 수 있는가
- 어떤 evidence로 닫힘을 입증할 수 있는가

답이 "설계 문서가 생긴다"뿐이라면, 그 항목은 보통 `task`나 `project`가 아니라 `design` 또는 `guide`여야 합니다. 정말로 설계 자체를 닫아야 한다면 처음부터 `design-only` 예외를 명시합니다.

## Splitting Rules

분할은 실행 통제를 위한 것이지 완료 기준 축소를 위한 것이 아닙니다.

- 하나의 기능 단위가 여전히 같은 문서에서 닫힌다면 새 문서를 만들기보다 내부 WBS를 더 세밀하게 쪼갭니다.
- 별도의 기능 경계, 별도 gate, 별도 ownership이 생겼다면 새 `task`나 `project`를 발급할 수 있습니다.
- 후속 문서를 발급했더라도 현재 문서의 핵심 목표가 남아 있다면 현재 문서는 계속 `active` 또는 `blocked`입니다.
- 기존 문서가 잘못 발급되어 경계를 다시 잡아야 한다면 기존 문서는 `superseded`로 닫고, 대체 문서를 명시합니다.

## Design-Only Exception

`design-only`는 아래 조건을 모두 만족할 때만 씁니다.

- 설계 문서, 계약, 정책, 인터페이스 정의 자체가 이번 항목의 최종 deliverable입니다.
- 무엇이 authoritative truth로 잠기는지 명확합니다.
- 후속 구현 또는 운영 task가 별도로 이어질 것을 문서에 적습니다.

설계 초안만 작성했거나 조사만 했다는 이유로 `functional` 항목을 `done` 처리하지 않습니다.

## Done Checklist

`done`으로 바꾸기 전에 아래를 확인합니다.

- 발급 시점의 Purpose가 그대로 달성되었는가
- 필수 Scope가 실제로 닫혔는가
- `functional` 항목이라면 실제 동작 evidence가 있는가
- 남은 핵심 목표를 후속 문서로 넘긴 뒤 현재 문서를 `done`으로 위장하지 않았는가
- `design-only` 예외라면 authoritative design 문서와 후속 구현 경계가 함께 기록되었는가

하나라도 아니면 `done`이 아닙니다.

## Status Decision Rule

- `done`: 발급 시점의 목표가 선언된 `Completion Mode` 기준으로 달성되었을 때
- `active` 또는 `blocked`: 목표는 그대로지만 아직 달성되지 않았을 때
- `superseded`: 목표나 경계가 새 문서로 재발급되어 기존 문서가 더 이상 기준이 아닐 때
- `cancelled`: 목표를 달성하지 않은 채 의도적으로 중단했을 때

## Change Log

- 2026-04-13: goal lock, 기능 단위 기본값, design-only 예외, `done` 체크리스트 규칙 추가.
