---
type: design
design_kind: context-map
title: {{TITLE}}
display_title:
human_summary:
presentation_status: missing
presentation_ref:
status: draft
domain:
bounded_context: all
bounded_context_id: CONTEXT-MAP
subdomain_type: portfolio
model_revision: 1
validation_status: unreviewed
validation_ref:
domain_expert_agent: ai-domain-expert
domain_expert_roles: []
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner:
created: {{DATE}}
updated: {{DATE}}
retrieval_class:
  - context-map
context:
  default_load: true
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by: []
source_refs: []
tags:
  - docs/design
  - ddd
  - context-map
---

# {{TITLE}}

## Human Review Summary

- 이 지도가 필요한 이유:
- 사람이 먼저 이해할 관계:
- 지금 결정할 것:

## Purpose

## Bounded Context Registry

| Bounded Context ID | Name | Responsibility | Subdomain Type | Owner / Expert | Model Ref |
| --- | --- | --- | --- | --- | --- |
| BC-... | | | core / supporting / generic | | |

## Context Relationships

| Upstream | Downstream | Human Meaning | Failure Ownership | Relationship Pattern | Published Language / ACL | Consistency |
| --- | --- | --- | --- | --- | --- | --- |
| BC-... | BC-... | 사람이 이해할 정보 전달 이유와 결과 | 실패를 판단하고 설명할 영역 | Customer-Supplier / ACL / Published Language / Shared Kernel / Conformist | | |

## Cross-Context Flows

## Translation And Ambiguity Rules

## Role Consumer Contract

## Unknowns And Disputes

## Change Impact

## Change Log

- {{DATE}}: context map draft 생성.
