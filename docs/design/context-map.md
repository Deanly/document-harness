---
type: design
design_kind: context-map
title: document-harness-context-map
display_title: 문서 하네스 업무 영역의 연결 관계
human_summary: 각 업무 영역이 무엇을 주고받고 실패했을 때 누가 책임지는지 사람이 읽는 말로 설명합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: all
bounded_context_id: CONTEXT-MAP-DOCUMENT-HARNESS
subdomain_type: portfolio
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_agent: ai-domain-expert
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
  - context-map
context:
  default_load: true
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/guide/ddd-domain-design.md
  - docs/_indexes/context-packets.yaml
source_refs:
  - docs/design/domain-landscape.md
tags:
  - docs/design
  - ddd
  - context-map
---

# document-harness-context-map

## Purpose

이 map은 역할과 AI가 작업 전에 정확한 bounded context, 책임 소유자, upstream/downstream와 translation boundary를 선택하도록 합니다.

## Human Review Summary

- 이 영역의 책임: 업무 영역 사이에 무엇을 전달하고 실패했을 때 누가 책임지는지 설명합니다.
- 포함하지 않는 것: 한 업무 영역의 승인 권한이나 내부 업무 규칙을 다른 영역으로 넘기지 않습니다.
- 사용자에게 보이는 실패: 관계 설명이 없는 연결은 기술 표로 대신 보여 주지 않고 검토 필요로 알립니다.
- 아직 결정할 것: 도입 대상 저장소의 실제 사업 업무 관계는 저장소 소유자와 도메인 전문가가 확정해야 합니다.

## Bounded Context Registry

| Bounded Context ID | Name | Responsibility | Subdomain Type | Owner / Expert | Model Ref |
| --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | governance | policy, guideline, approval, initiative authority | core | governance owner | `docs/design/contexts/governance/domain-model.md` |
| BC-EXECUTION | execution | task goal, checkpoint, attention, evidence, closeout | core | delivery owner | `docs/design/contexts/execution/domain-model.md` |
| BC-ADOPTION | adoption | ownership-aware install, migration, verification, rollback | supporting | repository owner | `docs/design/contexts/adoption/domain-model.md` |
| BC-RETRIEVAL | retrieval | source identity, revision, search visibility, freshness | generic | knowledge owner | `docs/design/contexts/retrieval/domain-model.md` |

## Context Relationships

| Upstream | Downstream | Human Meaning | Failure Ownership | Relationship Pattern | Published Language / ACL | Consistency |
| --- | --- | --- | --- | --- | --- | --- |
| BC-ADOPTION | BC-GOVERNANCE | 기존 저장소에서 찾은 정책 후보와 근거를 사람의 검토 대상으로 넘깁니다. | 도입은 추출과 최신성, 거버넌스는 의미와 승인을 책임집니다. | Customer-Supplier + Published Language | governance catalog candidate schema; approval meaning은 Governance가 소유 | captured revision/hash fence |
| BC-GOVERNANCE | BC-EXECUTION | 사람이 승인한 방향과 정확한 근거를 실행할 작업에 전달합니다. | 거버넌스는 승인 권한, 실행은 적용 결과와 증거를 책임집니다. | Customer-Supplier + Published Language | exact policy/rule/initiative IDs와 approval refs | task start/closeout에서 pin |
| BC-RETRIEVAL | BC-GOVERNANCE | 찾은 원문의 위치와 변경 여부를 정책 검토에 제공합니다. | 검색은 원문 발견과 최신성, 거버넌스는 의미 해석을 책임집니다. | Open Host Service + ACL | source revision/hash와 freshness state | read fence |
| BC-RETRIEVAL | BC-EXECUTION | 현재 작업에 필요한 최신 원문을 정확한 위치와 함께 제공합니다. | 검색은 원문 최신성, 실행은 원문을 사용한 행동을 책임집니다. | Open Host Service + ACL | direct-read/current revision contract | task context load |

## Cross-Context Flows

- Adoption → Governance: source-backed candidate와 migration attention을 전달하며 approval을 추론하지 않습니다.
- Governance → Execution: approved direction과 exact revision을 전달하며 task가 이를 약화할 수 없습니다.
- Retrieval → all: source candidate와 freshness를 제공하며 source truth 자체를 소유하지 않습니다.
- Architecture Board → all: read-only projection이며 command나 approval을 생성하지 않습니다.

## Translation And Ambiguity Rules

- `status`는 context-local입니다. Governance approval state, Initiative lifecycle, Task lifecycle와 Execution loop state를 합치지 않습니다.
- `policy`는 Governance의 human authority이고, Execution의 guard/invariant와 같은 말로 대체하지 않습니다.
- `checkpoint`는 Execution의 resumable snapshot이며 Retrieval checkpoint나 Git revision과 구분합니다.
- context 간 공통 token은 stable ID와 published contract로 번역합니다.

## Role Consumer Contract

- customer/planner는 Landscape에서 시작해 Governance와 실제 사업 context의 language/examples를 읽습니다.
- architect는 모든 boundary 변경 전에 이 Context Map을 읽습니다.
- developer/QA는 target context와 Execution context를 함께 읽되 Architecture 문서에서 business meaning을 만들지 않습니다.

## Unknowns And Disputes

- downstream repository의 사업 bounded context는 adoption discovery 후 이 map을 확장해야 합니다.

## Change Impact

- context relationship 변경은 published schema, role packet, task domain refs, QA derivation과 Board projection을 재검토합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 업무 관계 설명과 사람용 보드 표현을 추가했다.
- 2026-07-29: 네 bounded context와 translation/failure ownership을 정의했다.
