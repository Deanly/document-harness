# {{TITLE}}

- Type: design
- Domain:
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}
- Referenced By:

## Context

이 설계 문서가 다루는 도메인, 경계, 배경을 적습니다.

## Whole-System Role

- 이 설계가 전체 시스템 목표를 어떻게 붙잡는지 적습니다.
- `docs/design/control-plane.md`에서 이 설계가 담당하는 control surface를 적습니다.

## Boundary

- 포함하는 책임
- 포함하지 않는 책임
- 외부 시스템과의 경계

## Domain Model

- 주요 엔티티
- 주요 값 객체
- 주요 상태 전이

## Invariants

- 반드시 지켜져야 하는 규칙

## Failure Boundaries

- 어떤 실패는 이 설계 안에서 흡수하는가
- 어떤 실패는 상위 운영 또는 downstream으로 넘기는가
- 어떤 실패는 절대 조용히 삼키지 않는가

## Interfaces

- 내부 인터페이스
- 외부 인터페이스
- 입력/출력 계약

## Artifact Contracts

- 이 설계가 authoritative truth로 잠그는 산출물
- 이 설계를 입력으로 읽는 project/task/guide/report
- 설계 변경 시 같이 갱신해야 하는 문서

## Quality Axes

- 이 설계가 특히 강하게 붙잡아야 하는 quality axis
- 각 axis가 깨졌을 때 어떤 회귀가 생기는지

## Decisions

- 핵심 설계 결정과 이유

## Open Questions

- 추가 검토가 필요한 항목

## Change Log

- {{DATE}}: design 문서 생성.
