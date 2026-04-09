# runtime-and-gates-guide

- Type: guide
- Created: 2026-04-10
- Updated: 2026-04-10
- Related Project: P0001-example-invoice-ingestion
- Related Task: T0001-bootstrap-source-ingest
- Related Design: invoice-event-ingestion

## Purpose

이 guide는 example project에서 왜 `raw preservation -> normalized event -> delivery` 순서로 작업을 진행하는지와, 다음 단계로 넘어가기 위한 gate를 어떻게 잡는지를 설명합니다.

## Decision / Rule

- 첫 gate가 열리기 전에는 delivery automation을 확정하지 않습니다.
- raw preservation evidence가 있어야 parser 확장이 의미를 가집니다.
- end-to-end 성공보다 rerun safety를 먼저 증명합니다.

## Background

초기 ingestion 프로젝트는 외부 입력이 자주 바뀌고 실패 유형도 많기 때문에, 처음부터 자동화 전체를 잠그면 설계보다 운영 가정이 먼저 굳어지는 문제가 생깁니다.

따라서 example project는 아래 순서를 따릅니다.

1. source contract와 raw schema 고정
2. normalized event happy path 확인
3. failure preservation 확인
4. rerun and delivery baseline 정리

## Recommended Practice

- gate 이름을 문서에 명시합니다.
- 각 gate는 "무엇이 열려야 다음 단계가 의미가 생기는가"를 기준으로 정의합니다.
- task status에는 evidence를 함께 적습니다.
- 운영 baseline은 end-to-end 검증 이후에만 done 처리합니다.

## References

- `docs/examples/P0001-example-invoice-ingestion.md`
- `docs/examples/T0001-bootstrap-source-ingest.md`
- `docs/examples/invoice-event-ingestion.md`

## Change Log

- 2026-04-10: example guide 문서 생성.
