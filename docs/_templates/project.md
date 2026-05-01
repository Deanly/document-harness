# {{DOC_ID}} {{TITLE}}

- Type: project
- Document ID: {{DOC_ID}}
- Status: draft
- Project Role: umbrella
- Umbrella Initiative: {{TITLE}}
- Parent Umbrella Project: self
- Completion Mode: functional
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}
- Current Focus:
- Related Control Plane: docs/design/control-plane.md
- Related Design:

## Purpose

이 프로젝트의 목적과 기대 결과를 적습니다.

## Umbrella Lineage

- 이 문서가 human-facing umbrella project인지, 예외 분기 project인지 적습니다.
- `Project Role: umbrella`면 이 문서가 initiative의 기본 owner라고 적습니다.
- `Project Role: exception-branch`면 parent umbrella project와 lineage 관계를 적습니다.

## Project Issuance Check

- 이 문서는 human-facing owner를 잠그는 surface이므로 사람만 발급합니다.
- 에이전트가 초안을 준비했다면 어떤 human 요청 또는 승인으로 발급했는지 적습니다.
- 이 문서가 새 `project`여야 하는 이유를 적습니다.
- 예외 분기 project라면 왜 기존 umbrella project의 `task`로는 안 되는지 적습니다.
- 예외 분기 project라면 왜 human 입장에서 별도 project가 더 이해하기 쉬운지 적습니다.

## Whole-System Anchor

- 이 project가 전체 시스템 목표 중 무엇을 직접 delivery boundary로 소유하는지 적습니다.
- 어떤 control-plane 항목, design invariant, handoff를 깨면 안 되는지 적습니다.

## Completion Mode Notes

- 지원 mode: `functional`, `design-lock`, `decision-lock`, `investigation`, `integration`, `migration`, `operational-baseline`, `remediation`, `decommission`
- 기본값은 `functional`입니다.
- `functional`이 아니라면 왜 이 mode가 맞는지와 무엇이 closed state가 되는지 적습니다.

## Committed Outcome

- 이 project가 `done`일 때 실제로 새로 가능해져야 하는 기능, 운영 기준, delivery boundary 또는 locked state를 적습니다.
- 선택한 mode가 `functional`이 아니라면 authoritative artifact 또는 종료 상태를 구체적으로 적습니다.

## Goal Inventory

발급 시점에 잠그는 goal을 한 줄씩 적습니다. `Goal ID`는 후속 분해가 생겨도 유지합니다.

| Goal ID | Locked Goal | Done When |
| --- | --- | --- |
| G1 | 이 project가 닫히려면 반드시 성립해야 하는 핵심 목표 1 | 어떤 상태와 evidence가 있으면 이 goal을 닫을 수 있는지 |
| G2 | 이 project가 닫히려면 반드시 성립해야 하는 핵심 목표 2 | 어떤 상태와 evidence가 있으면 이 goal을 닫을 수 있는지 |

## Scope

- 포함 범위
- 직접 책임지는 delivery boundary

## Out Of Scope

- 후속 `task`, 예외 branch `project`, 또는 다른 시스템의 책임
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

1. project 목적에 적은 기능, 운영 기준, delivery boundary 또는 locked state가 선택한 `Completion Mode` 기준으로 닫혔음을 검증할 수 있습니다.
2. 필수 `task`가 모두 `done`이거나, 범위 재발급 근거와 함께 `superseded` 또는 `cancelled`로 정리되어 있습니다.
3. 남은 범위가 있다면 후속 `task` 또는 예외 branch `project`로 명시되며, 현재 project의 원래 목적을 축소한 `done` 처리로 위장하지 않습니다.

## Completion Evidence

- 선택한 `Completion Mode`를 닫는 데 필요한 로그, 문서, 측정치, 상태 변화, 운영 근거를 적습니다.
- 어떤 evidence가 있으면 충분하고, 어떤 evidence만으로는 부족한지도 적습니다.

## Outputs / Handoff

- 이 project가 닫힐 때 다음 `task`, 예외 branch `project`, downstream system, operator surface로 무엇을 넘기는지 적습니다.
- output path, operator note, residual scope, next consumer가 있으면 적습니다.

## Quality Axes In Scope

| Axis | Why It Matters Here | Required Evidence |
| --- | --- | --- |
| WHOLE | 전체 시스템 목표를 무엇으로 보존하는가 | |
| SCOPE | project 범위가 흐려지지 않았음을 무엇으로 보이는가 | |
| HANDOFF | 다음 surface로 무엇을 넘기는가 | |

## Goal Verification

`Goal Inventory`의 각 `Goal ID`를 1:1로 다시 적고 현재 상태와 evidence를 기록합니다.

| Goal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| G1 | Pending | | |
| G2 | Pending | | |

## Completion Guardrails

- 기존 Purpose를 더 작은 하위 조각으로 축소해 `done` 처리하지 않습니다.
- 남은 핵심 목표를 후속 project나 task로 넘겼다면 이 project는 `done`이 아니라 `active`, `blocked`, `superseded`, `cancelled` 중 하나여야 합니다.
- `done`으로 닫기 전 `Goal Inventory`와 `Goal Verification`을 맞추고 `./docs/bin/validate-closeout.sh`를 통과해야 합니다.
- `Related Control Plane`, `Whole-System Anchor`, `Outputs / Handoff`, `Quality Axes In Scope` 없이 부분 delivery를 전체와 분리된 local project처럼 닫지 않습니다.
- 새 `project`를 쉽게 남발하지 않으며, 기본값은 umbrella project 아래의 새 `task`입니다.
- `Completion Mode`는 terminal condition이어야 하며 `implementation-only`, `test-only`, `documentation-only`, `analysis-only` 같은 phase 이름을 쓰지 않습니다.

## Status

- {{DATE}}: project 문서 생성.
