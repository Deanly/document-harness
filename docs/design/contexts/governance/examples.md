---
type: design
design_kind: domain-examples
title: governance-domain-examples
display_title: 정책과 추진 결정 사례
human_summary: 정책 후보를 근거와 함께 검토하고 승인, 보류, 예외를 사람이 결정하는 대표 상황을 설명합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: governance
bounded_context_id: BC-GOVERNANCE
subdomain_type: core
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - governance-owner
role_views:
  - customer
  - planner
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-30
retrieval_class:
  - domain-examples
context:
  default_load: false
  section_load: true
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/design/contexts/governance/domain-model.md
source_refs:
  - docs/design/contexts/governance/domain-model.md
tags:
  - docs/design
  - ddd
  - governance
  - examples
---

# governance-domain-examples

## Purpose

approval과 activation의 정상·stale·unauthorized 의미를 역할과 QA가 같은 example로 사용합니다.

## Business Examples

| Scenario ID | Kind | Actor / Goal | Given | When / Command | Then / Event | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| SCN-GOV-001 | normal | policy owner가 rule을 승인 | source/effective SHA가 current | CMD-GOV-APPROVE-POLICY | EVT-GOV-POLICY-APPROVED | BR-GOV-003 |
| SCN-GOV-002 | normal | sponsor가 initiative를 활성화 | issued draft와 별도 activation receipt | CMD-GOV-ACTIVATE-INITIATIVE | EVT-GOV-INITIATIVE-ACTIVATED | BR-GOV-002 |
| SCN-GOV-003 | rejection | AI가 proposal을 effective로 만듦 | human receipt 없음 | CMD-GOV-APPROVE-POLICY | unauthorized 거절 | BR-GOV-001 |
| SCN-GOV-004 | boundary | 승인 후 artifact가 변경됨 | receipt SHA와 current bytes 불일치 | downstream read | stale 처리 | BR-GOV-003 |

## Counterexamples

- `approval_status: approved` 문자열만 추가해 current authority로 사용하는 행위
- initiative 발급 승인을 activation 승인으로 재사용하는 행위

## QA Derivation

| Scenario ID | QA Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| SCN-GOV-001 | receipt match | human actor/source/effective hash 일치 | authority validator fixture |
| SCN-GOV-003 | self-approval reject | human receipt 없으면 non-zero | validator fixture |
| SCN-GOV-004 | stale reject | bytes 변경 후 승인 상태 publish 금지 | projection test |

## Unknowns And Disputes

- 실제 approver directory와 signature verification은 organization profile이 정합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: governance examples 초안을 작성했다.
