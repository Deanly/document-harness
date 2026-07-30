---
type: design
design_kind: domain-examples
title: adoption-domain-examples
display_title: 안전한 도입 사례
human_summary: 기존 저장소를 훼손하지 않고 문서 하네스를 설치하고 검증하는 대표 상황을 사례로 설명합니다.
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
  - docs/design/contexts/adoption/domain-model.md
source_refs:
  - docs/design/contexts/adoption/domain-model.md
tags:
  - docs/design
  - ddd
  - adoption
  - examples
---

# adoption-domain-examples

## Purpose

fresh initialize, mature conflict, stale apply와 safe rollback을 같은 example로 설명합니다.

## Business Examples

| Scenario ID | Kind | Actor / Goal | Given | When / Command | Then / Event | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| SCN-ADOPT-001 | normal | adopter가 fresh repo 계획 | harness 없음, target readable | CMD-ADOPT-PLAN | EVT-ADOPT-PLAN-READY, writes 0 | BR-ADOPT-001 |
| SCN-ADOPT-002 | boundary | mature repo 소유권 보존 | customized design/dirty bytes | CMD-ADOPT-PLAN | EVT-ADOPT-DECISION-NEEDED, writes 0 | BR-ADOPT-002 |
| SCN-ADOPT-003 | normal | exact plan 적용 | plan hash/target fence 일치 | CMD-ADOPT-APPLY | EVT-ADOPT-APPLIED | BR-ADOPT-003 |
| SCN-ADOPT-004 | rejection | plan 후 target 변경 | plan target fence stale | CMD-ADOPT-APPLY | stale 거절, writes 0 | BR-ADOPT-003 |
| SCN-ADOPT-005 | rejection | 적용 후 project file 수정 | receipt postimage 불일치 | CMD-ADOPT-ROLLBACK | decision needed, writes 0 | BR-ADOPT-004 |

## Counterexamples

- mature repository에 public harness 파일을 wholesale copy
- View가 fresh하다는 이유로 migration verified 선언

## QA Derivation

| Scenario ID | QA Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| SCN-ADOPT-001 | no-write plan | target bytes 변화 0 | adoption tests |
| SCN-ADOPT-002 | project-owned preserve | conflict action이 overwrite하지 않음 | ownership fixture |
| SCN-ADOPT-004 | stale apply reject | exit non-zero, writes 0 | stale plan test |
| SCN-ADOPT-005 | rollback fence | changed postimage를 덮지 않음 | rollback test |

## Unknowns And Disputes

- 삭제 예정 legacy path 처리 방식은 versioned migration contract가 필요합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: adoption examples 초안을 작성했다.
