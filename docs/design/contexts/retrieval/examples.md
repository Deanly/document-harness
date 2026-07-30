---
type: design
design_kind: domain-examples
title: retrieval-domain-examples
display_title: 원문 찾기와 최신성 확인 사례
human_summary: 필요한 문서를 찾고 현재 원문과 일치하는지 확인하며 오래된 근거를 구분하는 대표 상황을 설명합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: retrieval
bounded_context_id: BC-RETRIEVAL
subdomain_type: generic
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - knowledge-owner
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
  - docs/design/contexts/retrieval/domain-model.md
source_refs:
  - docs/design/contexts/retrieval/domain-model.md
tags:
  - docs/design
  - ddd
  - retrieval
  - examples
---

# retrieval-domain-examples

## Purpose

same-session write, delete, rename과 incompatible generation의 freshness example을 제공합니다.

## Business Examples

| Scenario ID | Kind | Actor / Goal | Given | When / Command | Then / Event | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| SCN-RET-001 | boundary | AI가 방금 수정한 model을 읽음 | source N, index N-1 | CMD-RET-QUERY | EVT-RET-DIRECT-READ-USED 또는 N 대기 | BR-RET-001 |
| SCN-RET-002 | normal | owner가 문서 삭제 | settled scan에서 absence 확인 | CMD-RET-RECONCILE | EVT-RET-DOCUMENT-TOMBSTONED | BR-RET-002 |
| SCN-RET-003 | normal | owner가 문서 rename | stable identity와 동일 bytes | CMD-RET-RECONCILE | EVT-RET-DOCUMENT-RENAMED | BR-RET-003 |
| SCN-RET-004 | rejection | query가 incompatible arms를 조합 | generation/revision 불일치 | CMD-RET-QUERY | degraded/direct-read | BR-RET-004 |

## Counterexamples

- 검색 결과가 없다는 이유로 source가 없다고 단정
- mtime이 최근이라는 이유로 current revision이라고 판단

## QA Derivation

| Scenario ID | QA Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| SCN-RET-001 | read-your-writes | N 미만 hit를 사용하지 않음 | freshness fixture |
| SCN-RET-002 | deletion visibility | tombstone 후 old result 0 | delete test |
| SCN-RET-003 | rename identity | identity 유지, old path excluded | rename test |
| SCN-RET-004 | generation fence | incompatible result publish 금지 | concurrency test |

## Unknowns And Disputes

- multi-repository ordering과 organization search scope는 별도 profile이 필요합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: retrieval examples 초안을 작성했다.
