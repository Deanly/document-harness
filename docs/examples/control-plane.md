# control-plane

- Type: design
- Domain: control-plane
- Owner: platform-team
- Created: 2026-04-14
- Updated: 2026-04-16
- Referenced By:
  - `docs/examples/P0001-example-invoice-ingestion.md`
  - `docs/examples/T0001-bootstrap-source-ingest.md`
  - `docs/examples/invoice-event-ingestion.md`

## Purpose

이 문서는 example invoice ingestion 시스템에서 전체 목표, 표준 pipeline, active surface, validator를 한 곳에 모아 두는 central control surface입니다.

## Whole-System Outcome

- 공급업체 인보이스 입력을 수집하고, 원문 보존과 정규화 결과를 함께 남기는 최소 ingestion boundary를 안정적으로 구축합니다.
- 부분 task가 진행되더라도 raw preservation first, failure preservation, downstream handoff 기준을 잃지 않습니다.

## Control Surfaces

### Whole-System Control

- `control-plane.md`
- `invoice-event-ingestion.md`

### Focused Execution

- `P0001-example-invoice-ingestion.md`
- `T0001-bootstrap-source-ingest.md`

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `runtime-and-gates-guide.md`

## Active Design Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `control-plane.md` | 전체 목표와 validator 정렬 | Active | |
| `invoice-event-ingestion.md` | raw preservation / normalized event / failure preservation 경계 고정 | Active | |

## Umbrella Initiative Policy

- example invoice ingestion은 human-facing initiative 1개로 유지합니다.
- 최소 ingestion boundary delivery는 `P0001-example-invoice-ingestion.md`가 umbrella owner로 설명합니다.
- 후속 실행 단위는 먼저 그 umbrella 아래 `task`로 수용합니다.
- completion mode, owner, handoff 대상이 실질적으로 분리될 때만 예외 branch `project`를 검토합니다.

## Active Umbrella Projects

| Umbrella Project | Initiative | Status | Notes |
| --- | --- | --- | --- |
| `P0001-example-invoice-ingestion.md` | example invoice ingestion | Active | human-facing owner |

## Active Execution Surfaces

| Surface | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `P0001-example-invoice-ingestion.md` | 최소 ingestion boundary delivery와 lineage 관리 | Active | umbrella project |
| `T0001-bootstrap-source-ingest.md` | 첫 source ingest cycle 실행 | Active | umbrella 아래 task |

## Standard Pipeline

| Stage | Enters When | Produces | Exit Gate |
| --- | --- | --- | --- |
| Boundary lock | source, raw, normalized event, failure preservation 기준이 필요할 때 | `invoice-event-ingestion.md` | 설계와 용어가 잠김 |
| Project issue | example invoice ingestion initiative의 human-facing owner를 세워야 할 때 | `P0001-example-invoice-ingestion.md` | umbrella lineage와 project goal 고정 |
| Task issue | 기존 umbrella 아래 첫 source ingest cycle을 실제로 닫을 수 있을 때 | `T0001-bootstrap-source-ingest.md` | task goal inventory, placement, evidence 기준 고정 |
| Execute | raw, normalized, failure preservation을 구현하고 검증할 때 | logs, persistence, task status | closeout gate 통과 |

## Quality Axes

- `WHOLE`: raw preservation first와 failure preservation이 유지되는가
- `GOAL`: 발급된 ingest cycle goal이 축소되지 않는가
- `CONTRACT`: invoice event schema와 raw store contract가 유지되는가
- `EVIDENCE`: 실행 로그와 persistence 증빙이 있는가
- `HANDOFF`: downstream queue baseline과 후속 task handoff가 남는가

## Required Validators

- `./docs/bin/validate-harness-foundation.sh`
- `./docs/bin/validate-closeout.sh docs/examples/T0001-bootstrap-source-ingest.md`
- `./docs/bin/validate-closeout.sh docs/examples/P0001-example-invoice-ingestion.md`

## Handoff Rules

- design은 raw preservation first와 failure preservation invariant를 잠급니다.
- project는 최소 ingestion boundary를 delivery surface로 잡습니다.
- task는 첫 source ingest cycle evidence를 남기고 project closeout으로 handoff합니다.

## Change Log

- 2026-04-14: example control-plane 문서 생성.
- 2026-04-16: umbrella initiative policy와 active umbrella project 예시 추가.
