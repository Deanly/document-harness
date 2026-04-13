# P0001 example-invoice-ingestion

- Type: project
- Document ID: P0001
- Status: active
- Completion Mode: functional
- Owner: platform-team
- Created: 2026-04-10
- Updated: 2026-04-13
- Related Design: invoice-event-ingestion

## Purpose

이 프로젝트의 목적은 공급업체 인보이스 메일을 수집해 원문을 보존하고, downstream 정산 시스템이 소비할 수 있는 `invoice event`로 정규화하는 최소 ingestion 경계를 고정하는 것입니다.

## Committed Outcome

- 첫 소스에서 raw preservation, normalized invoice event, downstream queue publish baseline까지 이어지는 최소 ingestion boundary가 실제로 동작합니다.
- 이 project는 설계 정리만으로 닫히지 않으며, 기능 경계가 실제로 닫혀야 합니다.

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

## Completion Guardrails

- `raw preservation -> normalized event -> delivery baseline` 중 핵심 경계를 후속 project로 넘겼다면 현재 project는 `done`이 아닙니다.
- parser fixture expansion 같은 후속 고도화는 별도 범위일 수 있지만, 현재 project의 최소 ingestion boundary는 직접 닫아야 합니다.
- 설계 문서와 guide만 정리된 상태로는 이 project를 닫지 않습니다.

## Status

- 2026-04-10: project 문서 생성.
- 2026-04-10: example design과 guide를 기준 문서로 연결.
- 2026-04-10: 첫 task를 `raw preservation first` 순서로 시작.
- 2026-04-13: 기능 단위 완료 기준과 completion guardrails 예시를 추가.
