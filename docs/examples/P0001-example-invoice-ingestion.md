# P0001 example-invoice-ingestion

- Type: project
- Document ID: P0001
- Status: active
- Completion Mode: functional
- Owner: platform-team
- Created: 2026-04-10
- Updated: 2026-04-14
- Related Control Plane: control-plane
- Related Design: invoice-event-ingestion

## Purpose

이 프로젝트의 목적은 공급업체 인보이스 메일을 수집해 원문을 보존하고, downstream 정산 시스템이 소비할 수 있는 `invoice event`로 정규화하는 최소 ingestion 경계를 고정하는 것입니다.

## Whole-System Anchor

- 이 project는 `control-plane.md`의 전체 목표 중 최소 ingestion boundary delivery를 직접 소유합니다.
- raw preservation, normalized event, downstream handoff의 세 경계가 모두 정렬되어야 하며, 하나라도 후속 project로 넘겨 놓고 `done` 처리하면 안 됩니다.

## Completion Mode Notes

- 이 project는 `Completion Mode: functional`입니다.
- 종료 조건은 설계 잠금이 아니라 최소 ingestion boundary가 실제로 닫히는 것입니다.

## Committed Outcome

- 첫 소스에서 raw preservation, normalized invoice event, downstream queue publish baseline까지 이어지는 최소 ingestion boundary가 실제로 동작합니다.
- 이 project는 설계 정리만으로 닫히지 않으며, 기능 경계가 실제로 닫혀야 합니다.

## Goal Inventory

발급 시점에 잠그는 goal을 한 줄씩 적습니다. `Goal ID`는 후속 분해가 생겨도 유지합니다.

| Goal ID | Locked Goal | Done When |
| --- | --- | --- |
| G1 | 첫 source ingest path에서 raw preservation과 normalized invoice event 저장이 함께 동작합니다. | 실제 sample 실행에서 raw와 normalized 결과가 함께 확인됩니다. |
| G2 | downstream queue publish baseline이 이 project 범위 안에서 실행 기준으로 고정됩니다. | queue publish baseline이 설계가 아니라 실행 evidence와 함께 확인됩니다. |
| G3 | project closeout은 핵심 경계를 후속 project로 넘기지 않은 상태에서만 일어납니다. | 관련 task와 closeout evidence가 현재 project 안에서 정렬됩니다. |

## Scope

- 수신 메일 후보 수집
- raw invoice preservation
- normalized invoice event 추출
- downstream queue publish baseline 정의

## Out Of Scope

- OCR 정확도 개선 작업 전체
- 회계 시스템의 최종 분개 확정
- 지급 승인 워크플로우
- 벤더 포털 크롤링

## References

- `docs/examples/invoice-event-ingestion.md`
- `docs/examples/T0001-bootstrap-source-ingest.md`
- `docs/examples/runtime-and-gates-guide.md`

## WBS

| ID | Work Item | Status | Progress | Notes |
| --- | --- | --- | --- | --- |
| T0001 | Bootstrap source ingest | In Progress | 60% | raw preservation and normalized event baseline first |

## Planned Task Candidates

- parser fixture expansion
- queue delivery retry policy
- operator checklist hardening

## Overall Progress

- 35%

## Milestones

- boundary and terminology fixed
- first source ingest path works locally
- raw and normalized records persist together

## Exit Criteria

1. 첫 source ingest path에서 raw preservation과 normalized event 저장이 실제로 확인됩니다.
2. downstream queue publish baseline이 현재 project 범위 안에서 설계가 아니라 실행 기준으로 고정됩니다.
3. 남은 범위가 있더라도 현재 project의 원래 목적을 후속 project로 넘긴 뒤 `done`으로 처리하지 않습니다.

## Completion Evidence

- 첫 source ingest path 실행 로그
- raw record와 normalized invoice event persistence 확인 결과
- downstream queue publish baseline 확인 또는 smoke evidence
- 설계 문서만 정리된 상태는 충분한 evidence가 아님

## Outputs / Handoff

- 최소 ingestion boundary delivery evidence
- downstream queue publish baseline과 operator note
- parser fixture expansion, retry policy 같은 후속 project/task 후보

## Quality Axes In Scope

| Axis | Why It Matters Here | Required Evidence |
| --- | --- | --- |
| WHOLE | project가 전체 ingestion goal을 delivery boundary로 보존해야 합니다. | control-plane 참조, whole-system anchor |
| SCOPE | 최소 ingestion boundary를 더 작은 하위 조각으로 축소하면 안 됩니다. | scope / out-of-scope, goal verification |
| GOAL | 발급된 project goal을 후속 project로 넘겨 위장 closeout 하면 안 됩니다. | goal verification 전부 `Done` |
| EVIDENCE | boundary closeout은 실제 실행 evidence가 있어야 합니다. | source ingest logs, persistence, queue evidence |
| HANDOFF | 후속 project/task와 downstream operator가 읽을 수 있는 handoff가 있어야 합니다. | outputs / handoff, planned task candidates |

## Goal Verification

`Goal Inventory`의 각 `Goal ID`를 1:1로 다시 적고 현재 상태와 evidence를 기록합니다.

| Goal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| G1 | In Progress | 첫 source ingest path의 raw preservation과 normalized event 저장 기본 경로를 확인했습니다. | closeout에 필요한 전체 evidence는 아직 부족합니다. |
| G2 | Pending | | downstream queue publish baseline 실행 확인이 남아 있습니다. |
| G3 | Pending | | project closeout 시점 정렬은 핵심 task 종료 후에만 가능합니다. |

## Completion Guardrails

- `raw preservation -> normalized event -> delivery baseline` 중 핵심 경계를 후속 project로 넘겼다면 현재 project는 `done`이 아닙니다.
- parser fixture expansion 같은 후속 고도화는 별도 범위일 수 있지만, 현재 project의 최소 ingestion boundary는 직접 닫아야 합니다.
- `Goal Inventory`의 goal이 모두 `Done`으로 검증되기 전에는 이 project를 닫지 않습니다.
- `Whole-System Anchor`와 `Outputs / Handoff`가 비어 있으면 이 project를 닫지 않습니다.
- `Completion Mode`는 `functional`이므로 설계 문서와 guide만 정리된 상태로는 이 project를 닫지 않습니다.

## Status

- 2026-04-10: project 문서 생성.
- 2026-04-10: example design과 guide를 기준 문서로 연결.
- 2026-04-10: 첫 task를 `raw preservation first` 순서로 시작.
- 2026-04-14: whole-system anchor, goal inventory, handoff, quality axes 예시를 추가.
