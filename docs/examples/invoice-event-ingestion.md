# invoice-event-ingestion

- Type: design
- Domain: invoice-event-ingestion
- Owner: platform-team
- Created: 2026-04-10
- Updated: 2026-04-14
- Referenced By:
  - `docs/examples/control-plane.md`
  - `docs/examples/P0001-example-invoice-ingestion.md`
  - `docs/examples/T0001-bootstrap-source-ingest.md`

## Context

이 설계는 인보이스 후보 입력을 수집하고, 원문을 보존한 뒤, downstream 정산 시스템이 소비할 수 있는 `invoice event`로 정규화하는 최소 ingestion boundary를 정의합니다.

## Whole-System Role

- 이 설계는 `control-plane.md`의 전체 목표 중 raw preservation, normalized event, failure preservation contract를 붙잡습니다.
- `project`와 `task`가 부분 작업에 집중하더라도 전체 ingestion boundary를 잃지 않게 만드는 기준면입니다.

## Boundary

- 포함하는 책임
  - source candidate fetch
  - raw invoice preservation
  - normalized invoice event extraction
  - failure record preservation
- 포함하지 않는 책임
  - OCR 품질 최적화
  - 회계 승인
  - 최종 지급 truth 확정
- 외부 시스템과의 경계
  - 입력: source mailbox or upload queue
  - 출력: downstream settlement queue

## Domain Model

- `SourceCandidate`
  - 외부 입력에서 처음 읽은 후보 단위
- `RawInvoiceRecord`
  - 원문 기준으로 보존되는 최초 사실
- `InvoiceEvent`
  - downstream이 소비하는 정규화 결과
- `FailureRecord`
  - 파싱 또는 검증 실패를 버리지 않고 남긴 결과

## Invariants

- 원문은 정규화 성공 여부와 무관하게 먼저 저장합니다.
- 동일 원문은 deterministic ID로 중복 저장을 막습니다.
- 정규화 실패는 drop하지 않고 `FailureRecord`로 보존합니다.

## Failure Boundaries

- fetch 실패는 ingest cycle을 실패로 표시하되 source metadata와 함께 보존합니다.
- normalization 실패는 `FailureRecord`로 남기고 raw 보존 자체는 유지합니다.
- downstream publish 실패는 raw와 normalized 결과를 지운 채 조용히 끝내지 않습니다.

## Interfaces

- 내부 인터페이스
  - source reader
  - raw store
  - event normalizer
  - delivery publisher
- 외부 인터페이스
  - source fetch contract
  - downstream event publish contract
- 입력/출력 계약
  - 입력은 raw payload와 source metadata를 포함합니다.
  - 출력은 `invoice_event.v1` schema를 따릅니다.

## Artifact Contracts

- 이 설계는 `RawInvoiceRecord`, `InvoiceEvent`, `FailureRecord`가 authoritative model임을 잠급니다.
- `P0001-example-invoice-ingestion.md`와 `T0001-bootstrap-source-ingest.md`는 이 설계를 whole-system anchor의 일부로 읽습니다.
- 이 설계가 바뀌면 `control-plane.md`, project/task 문서, 관련 guide를 함께 갱신합니다.

## Quality Axes

- `WHOLE`: raw preservation, normalized event, failure preservation 세 경계를 함께 유지합니다.
- `CONTRACT`: `invoice_event.v1` contract와 raw store contract를 설계 truth로 고정합니다.
- `HANDOFF`: downstream settlement queue로 넘기는 결과 구조를 분명하게 정의합니다.

## Decisions

- v1은 raw preservation first로 시작합니다.
- 파싱 성공 범위는 가장 자주 등장하는 supplier template만 우선 지원합니다.
- 운영 모델은 rerunnable batch를 우선하고, 실시간성보다 재처리 가능성을 중시합니다.

## Open Questions

- supplier alias와 dedupe 기준을 운영 데이터로 얼마나 빨리 잠글 수 있는가
- retry backoff를 queue layer와 애플리케이션 중 어디가 소유할 것인가

## Change Log

- 2026-04-10: example design 문서 생성.
- 2026-04-10: raw preservation, normalized event, failure preservation 경계를 고정.
- 2026-04-14: whole-system role, artifact contracts, quality axes 예시를 추가.
