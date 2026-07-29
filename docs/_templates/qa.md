---
type: qa
doc_id: {{DOC_ID}}
title: {{TITLE}}
qa_type:
status: draft
governance_role: verification
domain_contract: v1
domain_impact: required
domain_impact_reason:
domain_review_ref:
domain_contexts: []
domain_model_refs: []
covered_rule_ids: []
covered_scenario_ids: []
source_documents: []
related_design: []
related_project:
actor_roles:
  - qa
owner:
created: {{DATE}}
updated: {{DATE}}
source_refs: []
policy_refs: []
standard_refs: []
tags:
  - docs/qa
---

# {{DOC_ID}} {{TITLE}}

- Type: qa
- Governance Role: verification
- Domain Contract: v1
- Domain Impact: required
- Domain Impact Reason:
- Domain Review Ref:
- Domain Contexts:
- Domain Model Refs:
- Covered Rule IDs:
- Covered Scenario IDs:
- Related Project:
- Actor Roles: qa
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

케이스/전략의 파생 근거가 되는 approved/current DDD model과 기획 문서만 나열합니다. **여기 없는 근거로 케이스를 추가하지 않습니다.**

- docs/design/contexts/<bounded-context>/domain-model.md
- docs/design/contexts/<bounded-context>/examples.md

## Test Levels / Case Matrix

qa_type에 따라 작성합니다: `strategy`는 테스트 레벨 정의, `plan`은 스위트 구성·게이트, `cases`는 케이스 매트릭스(+방어 갭 백로그), `runbook`은 절차 단계·판정 기준.

## Domain Rule And Scenario Coverage

| Rule ID | Scenario ID | Check ID | Pass Condition | Evidence | Verdict |
| --- | --- | --- | --- | --- | --- |
| BR-... | SCN-... | | | | |

모든 적용 `BR-*`와 `SCN-*`는 frontmatter `covered_rule_ids`, `covered_scenario_ids`와 이 표에 함께 나타나야 합니다.

## Traceability

| Policy Clause | Standard Rule | Task / Goal | Check ID | 검증 수단 / Pass Condition | Evidence | Exception | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

proposal report는 normative source가 아닙니다. policy/standard는 exact version과 stable clause/rule ID를 pin하고, exception은 base failure를 pass로 바꾸지 않고 ID/expiry를 남깁니다.

## Automation Coverage

- 자동화된 것 / 수동인 것 / 갭(우선순위)

## Maintenance Rules

이 문서를 갱신해야 하는 트리거를 명시합니다 (예: Source Documents의 design 변경, 결함 task closeout, 시나리오 카탈로그 변경).

## Evidence Log

- YYYY-MM-DD: 실행/검증 근거 요약과 링크

## Change Log

- {{DATE}}: 최초 작성.
