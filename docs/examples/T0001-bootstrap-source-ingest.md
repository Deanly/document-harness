# T0001 bootstrap-source-ingest

- Type: task
- Document ID: T0001
- Status: active
- Owner: platform-team
- Created: 2026-04-10
- Updated: 2026-04-10
- Related Project: P0001-example-invoice-ingestion
- Related Design: invoice-event-ingestion

## Purpose

이 task의 목적은 첫 입력 소스로부터 인보이스 후보를 읽고, 원문과 정규화 결과를 함께 남기는 최소 ingest cycle을 구현하는 것입니다.

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

## Risks / Open Questions

- 공급업체별 포맷 편차가 커서 v1 parser 성공 범위를 좁게 시작해야 합니다.
- 운영 스케줄러 도입 전까지는 수동 실행 검증이 필요합니다.

## Status

- 2026-04-10: task 문서 생성.
- 2026-04-10: raw preservation first 원칙으로 WBS를 정리.
- 2026-04-10: 첫 source sample에서 raw 저장과 normalized event 저장의 기본 경로를 확인.
