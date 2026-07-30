---
type: design
design_kind: domain-landscape
title: document-harness-domain-landscape
display_title: 문서 하네스가 맡는 업무의 전체 모습
human_summary: 문서 하네스가 다루는 정책, 실행, 설치, 검색 업무의 책임과 경계를 한눈에 설명합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: all
bounded_context_id: DOMAIN-DOCUMENT-HARNESS
subdomain_type: portfolio
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - document-harness-maintainer
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-30
retrieval_class:
  - core-start
context:
  default_load: true
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/design/context-map.md
  - docs/guide/ddd-domain-design.md
source_refs:
  - docs/README.md
  - docs/guide/harness-philosophy.md
tags:
  - docs/design
  - ddd
  - domain-landscape
---

# document-harness-domain-landscape

## Domain Vision And Customer Outcomes

document-harness는 여러 역할이 같은 업무 의미와 검증 가능한 현재 truth를 공유하면서 정책 방향, delivery와 실행을 분리해 안전하게 이어가도록 돕습니다. 핵심 고객 결과는 “무엇을 왜 해야 하고 어떤 의미와 규칙을 지키며 언제 완료됐는지”를 문서와 근거만으로 재구성할 수 있는 상태입니다.

## Human Review Summary

- 이 영역의 책임: 정책과 지침, 작업 실행, 안전한 도입, 원문 검색이 어떤 책임으로 나뉘는지 보여 줍니다.
- 포함하지 않는 것: 각 저장소의 실제 사업 규칙이나 사람의 승인 결정을 대신하지 않습니다.
- 사용자에게 보이는 실패: 설명이 없거나 승인 근거가 맞지 않는 영역은 일반 보드에서 숨기고 검토 필요로 알립니다.
- 아직 결정할 것: 문서 하네스를 도입한 각 저장소의 사업 업무 영역은 해당 도메인 전문가와 추가해야 합니다.

## Domain Experts And Sources

- Domain expert role: document-harness maintainer와 실제 적용 repository의 업무 책임자
- Customer roles: 고객/업무 전문가, 기획자, 설계자, 개발자, QA, 운영자
- Sources: repository의 human-owned policy, current DDD design, initiative/project/task, QA와 evidence
- 이 초안은 구조 적용 승인을 근거로 작성됐으며 exact model bytes는 별도 domain-expert review가 필요합니다.

## Subdomain Portfolio

| Bounded Context ID | Context | Business Capability | Subdomain Type | Owner / Expert | Model Ref | Validation State |
| --- | --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | governance | 사람의 정책·지침·추진 의도를 승인된 권한과 delivery 방향으로 고정 | core | governance owner / domain expert | `docs/design/contexts/governance/domain-model.md` | review_requested |
| BC-EXECUTION | execution | 승인된 방향을 목표가 잠긴 task, checkpoint, evidence와 closeout으로 수행 | core | delivery owner / executor | `docs/design/contexts/execution/domain-model.md` | review_requested |
| BC-ADOPTION | adoption | 기존 repository 소유권과 dirty state를 보존하며 harness를 도입·업그레이드·복구 | supporting | repository owner / adopter | `docs/design/contexts/adoption/domain-model.md` | review_requested |
| BC-RETRIEVAL | retrieval | source-authoritative document truth를 revision과 freshness를 보존해 찾고 읽게 함 | generic | knowledge owner / retrieval operator | `docs/design/contexts/retrieval/domain-model.md` | review_requested |

## Core Domain Differentiation

- Governance는 AI 제안과 사람 권한을 분리하고 exact approval fence를 delivery까지 잇습니다.
- Execution은 목표 축소, stale instruction과 근거 없는 완료를 차단합니다.
- 두 core context가 결합해 “그럴듯한 문서”가 아니라 사람의 의미와 증거가 연결된 실행을 만듭니다.

## Cross-Context Business Flows

1. Adoption이 repository source와 ownership을 보존해 governance/domain discovery candidate를 만듭니다.
2. Governance가 사람의 검토와 승인을 통해 적용 가능한 방향과 initiative lineage를 확정합니다.
3. Execution이 해당 domain model과 governance revision을 pin하고 task를 수행합니다.
4. Retrieval이 모든 역할에 필요한 current source와 stale 상태를 제공합니다.
5. Board는 이 context들의 source를 읽는 architecture projection이며 새 domain truth를 만들지 않습니다.

## Role Consumer Contract

| Role | Primary Questions | Required Contexts / Views |
| --- | --- | --- |
| customer / domain expert | 업무 의미, 결과, 정책과 예외가 맞는가 | landscape, governance language/examples |
| planner | outcome을 어떤 capability, rule과 scenario로 정의하는가 | governance + target context scenarios |
| architect | context boundary와 consistency/integration은 무엇인가 | context map + target aggregates |
| developer | 어떤 command/event/rule을 구현하는가 | target model/language/examples + execution |
| qa | 어떤 invariant와 scenario를 어떤 evidence로 검증하는가 | target rules/examples + execution evidence |

## Unknowns And Disputes

- 개별 downstream repository에서 실제 core domain은 이 reusable harness의 context가 아니라 해당 사업 domain입니다.
- 각 repository의 domain expert identity와 approval mechanism은 adoption 중 사람이 확정해야 합니다.

## Change Impact

- context 추가·분할·병합은 context map, role packets, project/task/QA domain refs와 Board domain projection에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목, 요약과 보드 검토 상태를 추가했다.
- 2026-07-29: governance, execution, adoption, retrieval subdomain portfolio 초안을 작성했다.
