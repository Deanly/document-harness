---
type: qa
doc_id: {{DOC_ID}}
title: {{TITLE}}
qa_type:
status: draft
owner:
created: {{DATE}}
updated: {{DATE}}
source_refs: []
tags:
  - docs/qa
---

# {{DOC_ID}} {{TITLE}}

- Type: qa
- Document ID: {{DOC_ID}}
- QA Type:
- Status: draft
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}

## Purpose

이 QA 문서가 지키는 품질 목표를 적습니다.

## Scope

- 다루는 도메인/기능 경계
- 다루지 않는 것

## Source Documents

케이스/전략의 파생 근거가 되는 기획·설계 문서만 나열합니다. **여기 없는 근거로 케이스를 추가하지 않습니다.**

- docs/design/...

## Test Levels / Case Matrix

qa_type에 따라 작성합니다: `strategy`는 테스트 레벨 정의, `plan`은 스위트 구성·게이트, `cases`는 케이스 매트릭스(+방어 갭 백로그), `runbook`은 절차 단계·판정 기준.

## Traceability

| Source (문서§/불변식) | Case ID | 검증 수단 | 상태 | 최근 증거 |
| --- | --- | --- | --- | --- |
| | | | | |

## Automation Coverage

- 자동화된 것 / 수동인 것 / 갭(우선순위)

## Maintenance Rules

이 문서를 갱신해야 하는 트리거를 명시합니다 (예: Source Documents의 design 변경, 결함 task closeout, 시나리오 카탈로그 변경).

## Evidence Log

- YYYY-MM-DD: 실행/검증 근거 요약과 링크

## Change Log

- {{DATE}}: 최초 작성.
