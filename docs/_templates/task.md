# {{DOC_ID}} {{TITLE}}

- Type: task
- Document ID: {{DOC_ID}}
- Status: draft
- Completion Mode: functional
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}
- Current Focus:
- Related Control Plane: docs/design/control-plane.md
- Related Umbrella Project: P0001-umbrella-project
- Related Project:
- Related Design:

## Purpose

이 task가 해결하려는 목적을 적습니다.

## Task Placement Check

- 왜 이 작업이 기존 umbrella project 아래의 `task`여야 하는지 적습니다.
- 왜 별도 `project`를 발급하지 않아도 되는지 적습니다.

## Whole-System Anchor

- 이 task가 전체 시스템 목표 중 무엇을 직접 보존하는지 적습니다.
- 어떤 control-plane 항목, design invariant, handoff를 깨면 안 되는지 적습니다.

## Completion Mode Notes

- 지원 mode: `functional`, `design-lock`, `decision-lock`, `investigation`, `integration`, `migration`, `operational-baseline`, `remediation`, `decommission`
- 기본값은 `functional`입니다.
- `functional`이 아니라면 왜 이 mode가 맞는지와 무엇이 closed state가 되는지 적습니다.

## Committed Outcome

- 이 task가 `done`일 때 실제로 새로 가능해져야 하는 기능, 실행 경계, locked state를 적습니다.
- 선택한 mode가 `functional`이 아니라면 authoritative artifact 또는 종료 상태를 구체적으로 적습니다.

## Goal Inventory

발급 시점에 잠그는 goal을 한 줄씩 적습니다. `Goal ID`는 후속 분해가 생겨도 유지합니다.

| Goal ID | Locked Goal | Done When |
| --- | --- | --- |
| G1 | 이 task가 닫히려면 반드시 성립해야 하는 핵심 목표 1 | 어떤 상태와 evidence가 있으면 이 goal을 닫을 수 있는지 |
| G2 | 이 task가 닫히려면 반드시 성립해야 하는 핵심 목표 2 | 어떤 상태와 evidence가 있으면 이 goal을 닫을 수 있는지 |

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

## Completion Evidence

- 선택한 `Completion Mode`를 닫는 데 필요한 로그, 문서, 측정치, 상태 변화, 운영 근거를 적습니다.
- 어떤 evidence가 있으면 충분하고, 어떤 evidence만으로는 부족한지도 적습니다.

## Outputs / Handoff

- 이 task가 닫힐 때 다음 task, project, downstream system으로 무엇을 넘기는지 적습니다.
- output path, operator note, residual risk, next consumer가 있으면 적습니다.

## Quality Axes In Scope

| Axis | Why It Matters Here | Required Evidence |
| --- | --- | --- |
| WHOLE | 전체 시스템 목표를 무엇으로 보존하는가 | |
| GOAL | 발급 시점 goal이 축소되지 않았음을 무엇으로 보이는가 | |
| EVIDENCE | closeout 증빙이 무엇인가 | |

## Goal Verification

`Goal Inventory`의 각 `Goal ID`를 1:1로 다시 적고 현재 상태와 evidence를 기록합니다.

| Goal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| G1 | Pending | | |
| G2 | Pending | | |

## Completion Guardrails

- 기존 Purpose를 더 작은 하위 조각으로 축소해 `done` 처리하지 않습니다.
- 남은 핵심 목표를 후속 task나 project로 넘겼다면 이 task는 `done`이 아니라 `active`, `blocked`, `superseded`, `cancelled` 중 하나여야 합니다.
- `done`으로 닫기 전 `Goal Inventory`와 `Goal Verification`을 맞추고 `./docs/bin/validate-closeout.sh`를 통과해야 합니다.
- `Related Control Plane`, `Whole-System Anchor`, `Outputs / Handoff`, `Quality Axes In Scope` 없이 부분 작업을 고립된 local task처럼 닫지 않습니다.
- 새 `project`를 만들 수 있는지 먼저 묻지 말고, 왜 이 작업이 기존 umbrella 아래 `task`인지 먼저 정렬합니다.
- `Completion Mode`는 terminal condition이어야 하며 `implementation-only`, `test-only`, `documentation-only`, `analysis-only` 같은 phase 이름을 쓰지 않습니다.

## Risks / Open Questions

- 없음

## Status

- {{DATE}}: task 문서 생성.
