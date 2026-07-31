---
type: design
design_kind: bounded-context
title: {{TITLE}}
display_title:
human_summary:
presentation_status: missing
presentation_ref:
status: draft
domain:
bounded_context: {{BOUNDED_CONTEXT}}
bounded_context_id:
subdomain_type:
model_revision: 1
validation_status: unreviewed
validation_ref:
domain_expert_agent: ai-domain-expert
authority_mode:
decision_tier:
board_review_level:
board_review_status:
board_decision_ref:
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
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by: []
source_refs: []
tags:
  - docs/design
  - ddd
  - bounded-context
---

# {{TITLE}}

- Type: design
- Design Kind: bounded-context
- Status: draft
- 사람용 제목:
- 사람용 요약:
- 사람용 설명 상태 / 검토 근거: missing /
- Domain:
- Bounded Context: {{BOUNDED_CONTEXT}}
- Bounded Context ID:
- Subdomain Type:
- Model Revision: 1
- Validation Status / Reference: unreviewed /
- AI Domain Expert: ai-domain-expert
- Authority / Decision Tier: /
- Board Review Level / Status: /
- Domain Expert Roles:
- Owner:
- Created: {{DATE}}
- Updated: {{DATE}}

## Human Review Summary

- 이 영역의 책임:
- 포함하지 않는 것:
- 사용자에게 보이는 실패:
- 아직 결정할 것:

## AI Domain Expert Board Review

- 권고 결정:
- 선택한 모델링 수준:
- 이 수준을 선택한 이유:
- 사람이 확인할 핵심:
- 승인하면 보호되는 결과:
- 반대하거나 수정해야 하는 조건:

## Domain Purpose And Customer Outcome

이 bounded context가 해결하는 고객·업무 문제, 성공 결과와 존재 이유를 도메인 언어로 적습니다.

## Domain Experts And Sources

도메인 사실을 확인할 사람의 역할과 source를 적습니다. 코드 동작만으로 업무 규칙을 확정하지 않습니다.

## Bounded Context Boundary

- 포함하는 business capability와 책임
- 포함하지 않는 책임
- upstream/downstream context
- 이 context 안에서만 유효한 용어 의미

## Ubiquitous Language

| Term ID | Term | Meaning In This Context | Examples / Counterexamples | Avoid | Source / Expert |
| --- | --- | --- | --- | --- | --- |
| TERM-... | | | | | |

## Domain Scenarios

| Scenario ID | Actor / Goal | Given | When / Command | Then / Domain Event | Related Rule |
| --- | --- | --- | --- | --- | --- |
| SCN-... | | | | | BR-... |

## Domain Model

### Aggregates

| Aggregate ID | Aggregate Root | Responsibility | Invariants | Commands | Events | Consistency Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| AGG-... | | | BR-... | CMD-... | EVT-... | |

### Entities

| Entity ID | Entity | Identity | Lifecycle | Owning Aggregate |
| --- | --- | --- | --- | --- |
| ENT-... | | | | AGG-... |

### Value Objects

| Value Object ID | Value Object | Meaning | Validity / Immutability | Used By |
| --- | --- | --- | --- | --- |
| VO-... | | | | |

### Commands

| Command ID | Command | Actor | Target Aggregate | Preconditions | Result Event / Rejection |
| --- | --- | --- | --- | --- | --- |
| CMD-... | | | AGG-... | BR-... | EVT-... |

### Domain Events

| Event ID | Domain Event | Producer | Business Meaning | Consumers | Published Contract |
| --- | --- | --- | --- | --- | --- |
| EVT-... | | AGG-... | | | |

### Domain Policies And Services

| Policy / Service ID | Kind | Trigger | Decision / Coordination | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| POL-... | policy / domain-service / process-manager | | | | |

## Business Rules And Invariants

| Rule ID | Rule / Invariant | Scope | Enforced By | Scenario Coverage | QA Coverage |
| --- | --- | --- | --- | --- | --- |
| BR-... | | AGG-... | | SCN-... | |

## State Transitions

| State Model | From | Command | Guard / Rule | To | Domain Event | Rejection |
| --- | --- | --- | --- | --- | --- | --- |
| | | CMD-... | BR-... | | EVT-... | |

## Context Relationships And Integration

| Related Context | Direction | Relationship Pattern | Contract / Translation | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-... | upstream / downstream | Customer-Supplier / ACL / Published Language / Shared Kernel / Conformist | | | |

## Failure And Exception Semantics

- 업무상 거절과 기술 실패를 구분합니다.
- 조용히 삼키면 안 되는 실패와 보상·재시도 소유자를 적습니다.
- 승인된 업무 예외와 모델 자체의 rule을 분리합니다.

## Role Consumer Contract

| Role | Questions This Model Answers | Required Sections / IDs | Required Downstream Output |
| --- | --- | --- | --- |
| customer | 고객 결과와 업무 의미가 맞는가 | 목적, language, scenarios | 의미 확인 또는 정정 |
| planner | capability, rule, flow와 예외는 무엇인가 | BR-*, CMD-*, EVT-*, SCN-* | 요구·수용 조건 |
| architect | 경계, aggregate, consistency, integration은 무엇인가 | BC-*, AGG-*, context relationships | 아키텍처·통합 결정 |
| developer | 어떤 모델과 규칙을 구현해야 하는가 | AGG-*, ENT-*, VO-*, CMD-*, EVT-*, BR-* | 코드·API·event·단위 테스트 |
| qa | 어떤 규칙과 전이를 검증해야 하는가 | BR-*, SCN-*, state transitions | traceable QA checks |

## Traceability

| Model ID | Source / Expert | Project / Task | API / Event / Code | QA Check | Evidence |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Decisions

- 핵심 도메인 모델 결정과 선택 이유를 적습니다.

## Unknowns And Disputes

- 확인되지 않은 사실, 경쟁하는 해석과 필요한 사람 결정을 적습니다.

## Change Impact

- 영향받는 역할, project/task/QA, published contract와 데이터 migration을 적습니다.

## Change Log

- {{DATE}}: bounded-context design draft 생성.
