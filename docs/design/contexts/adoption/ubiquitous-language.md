---
type: design
design_kind: ubiquitous-language
title: adoption-ubiquitous-language
display_title: 안전한 도입에서 함께 쓰는 말
human_summary: 저장소 소유자와 작업자가 설치, 이관, 검증, 되돌리기를 같은 뜻으로 말할 수 있게 정리합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: adoption
bounded_context_id: BC-ADOPTION
subdomain_type: supporting
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - repository-owner
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
  - term-excerpt
context:
  default_load: false
  section_load: true
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/design/contexts/adoption/domain-model.md
source_refs:
  - docs/design/contexts/adoption/domain-model.md
tags:
  - docs/design
  - ddd
  - adoption
  - ubiquitous-language
---

# adoption-ubiquitous-language

## Context Language Boundary

Adoption의 `plan`, `verified`, `rollback`은 delivery 계획이나 task 완료와 다른 의미입니다.

## Terms

| Term ID | Term | Meaning In This Context | Examples | Counterexamples | Avoid / Alias | Source / Expert |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-ADOPT-PLAN | adoption plan | apply 전에 mutation과 conflict를 고정한 no-write artifact | plan JSON/hash | 설치 명령 목록 | plan과 apply 혼용 | repository owner |
| TERM-ADOPT-PROJECT-OWNED | project-owned | target repository 사람이 소유해 upgrade가 덮지 않는 surface | AGENTS, domain design | harness runtime distribution | unmanaged와 혼용 | repository owner |
| TERM-ADOPT-INSTALLED | installed | plan의 mutation이 receipt와 함께 적용된 상태 | INSTALLED_AWAITING_REVIEW | migration verified | done이라 부르기 | adopter |
| TERM-ADOPT-VERIFIED | migration verified | gates, evidence와 human review가 완료된 상태 | MIGRATION_VERIFIED | View fresh | apply success와 혼용 | reviewer |

## State And Event Vocabulary

- planning: PLAN_READY, NEEDS_DECISION
- installation: INSTALLED_NOT_VERIFIED, INSTALLED_AWAITING_REVIEW, MIGRATION_VERIFIED, ROLLED_BACK

## Cross-Context Translations

| Local Term | Related Context | Their Term | Translation / ACL Rule |
| --- | --- | --- | --- |
| extraction candidate | BC-GOVERNANCE | proposal | unreviewed/source-fenced로만 전달 |
| installed domain design | BC-EXECUTION | domain model ref | approved/current 전에는 authoritative하지 않음 |

## Ambiguities And Disputes

- “업그레이드 완료”는 apply와 verify 중 무엇인지 명시해야 합니다.

## Change Impact

- term/state 변경은 CLI output, receipts, guide, tests와 View copy에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: adoption context language 초안을 작성했다.
