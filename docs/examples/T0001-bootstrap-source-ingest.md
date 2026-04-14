# T0001 bootstrap-source-ingest

- Type: task
- Document ID: T0001
- Status: active
- Completion Mode: functional
- Owner: platform-team
- Created: 2026-04-10
- Updated: 2026-04-14
- Related Control Plane: control-plane
- Related Project: P0001-example-invoice-ingestion
- Related Design: invoice-event-ingestion

## Purpose

이 task의 목적은 첫 입력 소스로부터 인보이스 후보를 읽고, 원문과 정규화 결과를 함께 남기는 최소 ingest cycle을 구현하는 것입니다.

## Whole-System Anchor

- 이 task는 `control-plane.md`의 raw preservation first, failure preservation, downstream handoff 기준을 유지해야 합니다.
- `invoice-event-ingestion.md`의 deterministic ID, raw-first 저장, failure record 보존 invariant를 깨면 안 됩니다.

## Completion Mode Notes

- 이 task는 `Completion Mode: functional`입니다.
- 종료 조건은 설계 정리가 아니라 최소 ingest cycle이 실제로 반복 가능하게 동작하는 것입니다.

## Committed Outcome

- 첫 입력 소스 1건 이상이 raw record와 normalized invoice event로 함께 남는 최소 ingest cycle이 실제로 동작합니다.
- 이 task는 설계 정리만으로 닫히지 않으며, ingest cycle 기능이 evidence와 함께 확인되어야 합니다.

## Goal Inventory

발급 시점에 잠그는 goal을 한 줄씩 적습니다. `Goal ID`는 후속 분해가 생겨도 유지합니다.

| Goal ID | Locked Goal | Done When |
| --- | --- | --- |
| G1 | 첫 입력 소스에서 raw record와 normalized invoice event가 함께 남는 ingest cycle이 성립합니다. | 최소 1건의 source sample이 raw와 normalized 결과로 함께 확인됩니다. |
| G2 | 동일 입력 rerun 시 raw record 중복 저장이 생기지 않습니다. | 동일 입력 재처리 결과와 저장 상태로 중복이 없음을 확인합니다. |
| G3 | 실패 샘플도 drop하지 않고 failure record로 남습니다. | 실패 샘플 실행 로그와 failure record 증빙이 남습니다. |
| G4 | closeout 시 상태 이력과 evidence가 task 문서에 남습니다. | `Status`와 `Goal Verification`에 closeout evidence가 기록됩니다. |

## Scope

- source fetch baseline 고정
- raw record 저장
- normalized invoice event 저장
- 최소 검증 로그와 상태 이력 정리

## Out Of Scope

- 다중 소스 통합
- 고급 dedupe 정책
- 운영 스케줄러 배포
- downstream accounting write path

## References

- `docs/examples/P0001-example-invoice-ingestion.md`
- `docs/examples/invoice-event-ingestion.md`
- `docs/examples/runtime-and-gates-guide.md`

## Dependencies

- `invoice-event-ingestion` design baseline이 먼저 고정되어 있어야 합니다.

## WBS

| ID | Work Item | Status | Progress | Notes |
| --- | --- | --- | --- | --- |
| W1 | Fix source contract and raw schema | Done | 100% | source payload, raw record fields, canonical IDs locked |
| W2 | Store normalized invoice event | In Progress | 50% | happy-path extraction works, failure classification remains |
| W3 | Verify and close | Todo | 0% | local rerun evidence and sample log cleanup pending |

## Overall Progress

- 60%

## Completion Criteria

1. 동일 입력을 두 번 처리해도 raw record 중복 저장이 생기지 않습니다.
2. 최소 1건의 source sample이 normalized invoice event로 저장됩니다.
3. 실패 샘플도 drop하지 않고 failure record로 남습니다.
4. task 종료 시 상태 이력에 무엇이 고정되었는지와 어떤 evidence가 있는지가 기록됩니다.

## Completion Evidence

- source sample rerun 로그
- raw record와 normalized invoice event 저장 결과
- failure sample 기록 예시
- WBS 일부 완료나 설계 문서 정리만 된 상태는 충분한 evidence가 아님

## Outputs / Handoff

- raw record schema와 normalized invoice event persistence evidence
- failure sample 보존 evidence
- project closeout과 downstream queue baseline 검토에 넘길 operator note

## Quality Axes In Scope

| Axis | Why It Matters Here | Required Evidence |
| --- | --- | --- |
| WHOLE | raw preservation first와 failure preservation을 유지해야 합니다. | control-plane와 design invariant 참조, raw/failure evidence |
| GOAL | ingest cycle goal을 raw-only나 normalized-only로 축소하면 안 됩니다. | goal verification 전부 `Done` |
| CONTRACT | raw store와 invoice event contract를 맞춰야 합니다. | persistence 결과, schema-aligned sample |
| EVIDENCE | closeout이 실행 증빙과 연결되어야 합니다. | rerun 로그, persistence 결과, failure record |
| HANDOFF | 다음 project/task가 읽을 수 있는 결과를 남겨야 합니다. | operator note, residual risk, output evidence |

## Goal Verification

`Goal Inventory`의 각 `Goal ID`를 1:1로 다시 적고 현재 상태와 evidence를 기록합니다.

| Goal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| G1 | In Progress | 첫 source sample에서 raw 저장과 normalized event 저장의 기본 경로를 확인했습니다. | 최소 1건 cycle은 보였지만 closeout evidence 정리는 남아 있습니다. |
| G2 | Pending | | rerun 중복 방지 확인이 남아 있습니다. |
| G3 | Pending | | failure sample 보존 evidence가 남아 있습니다. |
| G4 | Pending | | closeout 전이므로 최종 상태 이력과 evidence 기록이 남아 있습니다. |

## Completion Guardrails

- raw 저장만 끝났거나 normalized path만 끝난 상태에서, 남은 핵심 목표를 후속 task로 넘겼다고 해서 이 task를 `done` 처리하지 않습니다.
- 현재 Purpose가 유지되는 동안에는 내부 WBS를 더 잘게 쪼갤 수는 있어도 완료 기준 자체는 줄이지 않습니다.
- `Goal Inventory`의 goal이 모두 `Done`으로 검증되기 전에는 이 task를 닫지 않습니다.
- `Whole-System Anchor`와 `Outputs / Handoff`가 비어 있으면 이 task를 닫지 않습니다.
- `Completion Mode`는 `functional`이므로 설계 문서 정리만으로 닫지 않습니다.

## Risks / Open Questions

- 공급업체별 포맷 편차가 커서 v1 parser 성공 범위를 좁게 시작해야 합니다.
- 운영 스케줄러 도입 전까지는 수동 실행 검증이 필요합니다.

## Status

- 2026-04-10: task 문서 생성.
- 2026-04-10: raw preservation first 원칙으로 WBS를 정리.
- 2026-04-10: 첫 source sample에서 raw 저장과 normalized event 저장의 기본 경로를 확인.
- 2026-04-14: whole-system anchor, goal inventory, handoff, quality axes 예시를 추가.
