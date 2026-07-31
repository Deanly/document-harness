---
type: design
design_kind: domain-landscape
title: repository-domain-landscape
display_title: 먼저 실제 업무 영역과 담당자를 확인해 주세요
human_summary: 초기 설치는 저장소 구조만으로 업무 영역을 확정하지 않습니다. 담당자가 고객 결과와 업무 경계를 확인하기 전까지 이 문서는 발견이 필요하다는 사실만 보여줍니다.
presentation_status: review_requested
presentation_ref:
status: draft
domain: repository-domain
bounded_context: all
bounded_context_id: DOMAIN-REPOSITORY
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
  - docs/README.md
tags:
  - docs/design
  - ddd
  - adoption
---

# Repository Domain Landscape

## Human Review Summary

- 보호하거나 만들 결과: 저장소 구조를 업무 진실로 오해하지 않고 실제 담당자와 근거를 찾습니다.
- 이 구분이 필요한 이유: 디렉터리나 서비스 이름만으로 업무 경계를 확정하면 잘못된 모델이 실행 기준이 될 수 있습니다.
- 지금 결정할 것: 실제 고객 결과, 업무 담당자, 핵심 업무 영역과 근거 문서를 정해야 합니다.

## Domain Vision And Customer Outcomes

Initialization does not infer the business domain. The AI Domain Expert must replace this discovery boundary with source-backed customer outcomes and escalate only important or uncertain meaning to the repository owner through the Board.

## Domain Experts And Sources

- `repository-domain-owner` is a placeholder role, not an inferred person or approval.
- Identify business decision owners, authoritative business sources, AI Domain Expert delegation and Board escalation rules before promoting any model to `current`.

## Subdomain Portfolio

| Bounded Context ID | Context | Business Capability | Subdomain Type | Owner / Expert | Model Ref | Validation State |
| --- | --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | discovery-required | Business capability must be discovered from repository and human sources. | supporting | repository-domain-owner | not-issued | unreviewed |

## Core Domain Differentiation

Core, supporting, and generic subdomains are not established by initialization.

## Cross-Context Business Flows

- Not established. Do not infer flows from directory names or implementation modules alone.

## Role Consumer Contract

| Role | Primary Questions | Required Contexts / Views |
| --- | --- | --- |
| customer | What outcome and meaning are correct? | source-backed discovery |
| planner | Which capability, rule, and scenario define the outcome? | reviewed landscape and examples |
| architect | Which context owns consistency and integration? | reviewed context map |
| developer | Which commands, events, and rules are implementable? | approved context model |
| qa | Which invariants and scenarios require evidence? | approved rules and examples |

## Unknowns And Disputes

- Actual bounded contexts, core domain, business rules, examples, AI delegation scope and important human decisions remain to be modeled from repository evidence.

## Change Impact

- Replace BC-DISCOVERY with real context sets, role packets, project/task/QA refs, and Board projection inputs.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: initialization-safe discovery landscape added without inferring business truth.
