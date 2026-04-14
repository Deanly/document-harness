# artifact-contracts

- Type: guide
- Created: 2026-04-14
- Updated: 2026-04-14

## Purpose

이 문서는 `design`, `project`, `task`, `guide`, `report`가 각각 어떤 truth를 담고, 어떤 문서를 읽고, 어떤 문서로 handoff하는지 계약 형태로 고정합니다.

문서 품질이 흔들리는 가장 흔한 이유는 타입 경계가 약해서 같은 정보가 여러 surface에 중복되거나, 반대로 어디에도 authoritative truth가 없기 때문입니다.

## Control Surfaces

### Whole-System Control

- `docs/design/control-plane.md`: 전체 목표, pipeline, validator, active surface
- `docs/design/ubiquitous-language.md`: canonical term
- 핵심 `design`: boundary, invariant, interface, failure boundary

### Focused Execution

- `project`: 큰 delivery boundary, 분해 전략, handoff map
- `task`: 실제로 닫는 execution slice, goal inventory, evidence

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `Quality Axes In Scope`
- closeout validator와 foundation validator

## Artifact Contracts By Type

### `design`

- Holds: 현재 truth, 경계, 계약, invariant, failure boundary
- Reads: control-plane, ubiquitous-language, 관련 상위 요구
- Feeds: project, task, guide
- Must not hold: 긴 실행 이력, 임시 작업 메모

### `project`

- Holds: bounded delivery 목표, 범위, task map, whole-system anchor, handoff 방향
- Reads: control-plane, design, quality axes
- Feeds: task, report, 후속 project
- Must not hold: 미확정 브레인스토밍, 설계 truth의 원본

### `task`

- Holds: execution slice, goal inventory, goal verification, evidence, outputs / handoff
- Reads: project, design, control-plane, quality axes
- Feeds: 다음 task, downstream system, project closeout
- Must not hold: 전체 시스템 전략의 원본 정의

### `guide`

- Holds: 반복 판단, 운영 규칙, checklists, Q&A
- Reads: design, project, task, report
- Feeds: future task/project/operator
- Must not hold: current truth의 유일한 원본

### `report`

- Holds: 시점성 조사, 요청 응답, 일회성 정리
- Reads: 현재 active surface 전반
- Feeds: 필요 시 guide/design/project/task로 승격
- Must not hold: 장기 authoritative truth

## Handoff Matrix

| From | To | What Moves |
| --- | --- | --- |
| `design` | `project` | boundary, invariant, interface, out-of-scope 기준 |
| `project` | `task` | focused slice, local goal, execution order, quality axes |
| `task` | `task` | outputs / handoff, residual risk, operator note |
| `task` | `project` | closeout evidence, remaining scope, supersede/cancel reason |
| `report` | `guide/design/project/task` | reusable rule, truth, execution boundary |

## Authoring Rule

새 문서를 발급할 때는 아래를 먼저 확인합니다.

1. 이 정보의 authoritative truth는 어느 surface에 있어야 하는가
2. 이 문서는 무엇을 읽고 무엇을 넘기는가
3. handoff를 다음 문서가 다시 읽을 수 있게 충분히 구조화했는가

답이 모호하면 artifact contract가 약한 상태입니다.

## Change Log

- 2026-04-14: whole-system / focused execution / drift control artifact contract 규칙 추가.
