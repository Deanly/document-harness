# control-plane

- Type: design
- Domain: control-plane
- Owner:
- Created: 2026-04-14
- Updated: 2026-04-14
- Referenced By:
  - `docs/README.md`

## Purpose

이 문서는 전체 시스템 목표, 표준 pipeline, active control surface, quality axis, validator를 한 곳에 모아 두는 central control surface입니다.

`design`이 전체를 놓치지 않게 만드는 장치라면, 이 문서는 그 `design` 문서들 사이의 상위 정렬면입니다. 새 `project`와 `task`는 이 문서를 whole-system anchor로 참조해야 합니다.

## Whole-System Outcome

- 이 저장소가 어떤 개발 목표를 끝까지 추적해야 하는지 적습니다.
- 시스템 규모와 코드 규모가 커져도 무엇을 전체 truth로 유지해야 하는지 적습니다.
- 부분 작업 문서가 무엇을 절대 잃어버리면 안 되는지 적습니다.

## Control Surfaces

### Whole-System Control

- `docs/design/control-plane.md`
- `docs/design/ubiquitous-language.md`
- 현재 시스템 경계를 정의하는 핵심 `design` 문서

### Focused Execution

- active `project`
- active `task`
- WBS와 gate가 있는 실행 문서

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `docs/guide/quality-axes.md`
- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-closeout.sh`

## Active Design Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/design/control-plane.md` | 전체 목표, pipeline, validator 정렬 | Active | |
| `docs/design/ubiquitous-language.md` | canonical term 정렬 | Active | |
| `docs/design/<domain>.md` | 현재 시스템 경계와 계약 | Add | 필요한 도메인 설계를 추가합니다. |

## Active Execution Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `docs/projects/README.md` | active project 입구 | Active | |
| `docs/tasks/README.md` | active task 입구 | Active | |
| `docs/reports/README.md` | active report 입구 | Active | |

## Standard Pipeline

| Stage | Enters When | Produces | Exit Gate |
| --- | --- | --- | --- |
| Whole alignment | 전체 목표, 용어, 범위가 아직 흐릴 때 | `control-plane`, `ubiquitous-language`, 핵심 `design` | 전체 목표, 용어, 품질 축이 잠김 |
| Project issue | 별도 종료 기준이 있는 delivery boundary가 보일 때 | `project` | scope / out-of-scope / WBS / whole-system anchor 고정 |
| Task issue | 실제로 닫을 수 있는 execution slice가 생길 때 | `task` | goal inventory / handoff / quality axes 고정 |
| Execute | 구현, 검증, 운영 정렬이 진행될 때 | evidence, 상태 이력, 필요 시 guide/report | closeout gate 통과 |
| Closeout | 문서를 닫을 수 있을 때 | `done` 상태와 append-only closeout evidence | goal verification 전부 `Done` |

## Quality Axes

- 기본 품질 축은 `docs/guide/quality-axes.md`를 따릅니다.
- 새 프로젝트는 여기서 active axis를 선택하고, 각 `project`와 `task`에서 어떤 axis를 직접 책임지는지 적습니다.

## Required Validators

- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-closeout.sh --all`
- 필요하면 프로젝트별 build / test / smoke validator를 추가합니다.

## Handoff Rules

- `design`은 전체 truth를 잠그고 `project`와 `task`가 이를 읽습니다.
- `project`는 delivery boundary를 잠그고, `task`로 분해해 부분 실행을 통제합니다.
- `task`는 증빙과 handoff를 남기고 다음 `task`, `project`, downstream 시스템으로 넘깁니다.
- `report`는 시점성 정리를 담되, 재사용 가치가 생기면 상위 surface로 승격합니다.

## Change Log

- 2026-04-14: starter control-plane 문서 생성.
