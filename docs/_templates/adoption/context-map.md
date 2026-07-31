---
type: design
design_kind: context-map
title: repository-context-map
display_title: 업무 영역 사이의 관계를 확인해 주세요
human_summary: 초기 설치는 실제 업무 관계를 추측하지 않습니다. 담당자가 어떤 영역이 어떤 정보를 주고받으며 실패를 누가 책임지는지 확인할 때까지 발견 대기 상태로 표시합니다.
presentation_status: review_requested
presentation_ref:
status: draft
domain: repository-domain
bounded_context: all
bounded_context_id: CONTEXT-MAP-REPOSITORY
subdomain_type: portfolio
model_revision: 1
validation_status: unreviewed
validation_ref:
domain_expert_agent: ai-domain-expert
domain_expert_roles:
  - repository-domain-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: repository-domain-owner
created: 2026-07-29
updated: 2026-07-29
source_refs:
  - docs/design/domain-landscape.md
tags:
  - docs/design
  - ddd
  - adoption
---

# Repository Context Map

## Human Review Summary

- 이 지도가 필요한 이유: 서로 다른 업무 책임과 정보 전달 경계를 같은 구조로 오해하지 않기 위해서입니다.
- 사람이 먼저 이해할 관계: 실제 업무 담당자가 upstream, downstream과 실패 책임을 확인해야 합니다.
- 지금 결정할 것: 각 업무 영역의 이름, 전달 정보, 책임자와 실패 처리 경계를 정해야 합니다.

## Purpose

This draft makes the missing domain discovery explicit. It must not be treated as a map of actual business boundaries.

## Bounded Context Registry

| Bounded Context ID | Name | Responsibility | Subdomain Type | Owner / Expert | Model Ref |
| --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | discovery-required | Establish source-backed business boundaries. | supporting | repository-domain-owner | not-issued |

## Context Relationships

| Upstream | Downstream | Human Meaning | Failure Ownership | Relationship Pattern | Published Language / ACL | Consistency |
| --- | --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | BC-DISCOVERY | 실제 업무 관계를 아직 확인하지 않았습니다. | repository-domain-owner가 발견과 확인 요청을 소유합니다. | discovery-only | no published language yet | not established |

## Cross-Context Flows

- Not established by initialization.

## Translation And Ambiguity Rules

- Directory, service, team, and database boundaries are candidates, not bounded-context proof.

## Role Consumer Contract

- All roles stop at BC-DISCOVERY until human-reviewed landscape, context model, language, and examples exist.

## Unknowns And Disputes

- Actual upstream/downstream, relationship pattern, translation, consistency, and failure ownership require AI Domain Expert synthesis; material or uncertain boundaries require a Board decision.

## Change Impact

- Issuing real context sets requires updating this map, role packets, delivery lineage, and Board projection.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: initialization-safe discovery context map added.
