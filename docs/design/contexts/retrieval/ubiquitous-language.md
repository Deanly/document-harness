---
type: design
design_kind: ubiquitous-language
title: retrieval-ubiquitous-language
display_title: 원문 찾기와 최신성 확인에서 함께 쓰는 말
human_summary: 검색하는 사람과 도구가 원문, 위치, 버전, 최신성, 변경을 같은 뜻으로 이해하도록 정리합니다.
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
  - docs/design/contexts/retrieval/domain-model.md
source_refs:
  - docs/design/contexts/retrieval/domain-model.md
tags:
  - docs/design
  - ddd
  - retrieval
  - ubiquitous-language
---

# retrieval-ubiquitous-language

## Context Language Boundary

Retrieval의 source, revision, head와 freshness는 domain 의미나 execution checkpoint를 소유하지 않습니다.

## Terms

| Term ID | Term | Meaning In This Context | Examples | Counterexamples | Avoid / Alias | Source / Expert |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-RET-SOURCE | authoritative source | current truth를 소유하는 repository bytes | Markdown/Git file | index row | cache를 source라 부르기 | knowledge owner |
| TERM-RET-IDENTITY | document identity | rename에도 유지되는 logical document ID | doc_id/catalog ID | path hash만 사용 | path와 identity 혼용 | retrieval operator |
| TERM-RET-HEAD | document head | current revision/hash/path/presence pointer | active head | latest timestamp | index hit과 혼용 | retrieval operator |
| TERM-RET-TOMBSTONE | tombstone | deleted/renamed old revision의 logical exclusion | ABSENT_CONFIRMED | temporary missing | physical delete와 혼용 | operator |
| TERM-RET-FRESHNESS | freshness proof | result가 required revision 이상임을 보이는 evidence | read-your-writes/direct | “방금 조회함” | recency와 혼용 | consumer |

## State And Event Vocabulary

- presence: PRESENT, INDETERMINATE, ABSENT_CONFIRMED
- freshness: fresh, stale, degraded, unknown, direct

## Cross-Context Translations

| Local Term | Related Context | Their Term | Translation / ACL Rule |
| --- | --- | --- | --- |
| source revision | BC-GOVERNANCE | source fence | revision + content hash로 전달 |
| freshness proof | BC-EXECUTION | current domain/task ref | required revision 충족 여부만 전달 |

## Ambiguities And Disputes

- “latest”는 comparable revision 없이 사용하지 않습니다.

## Change Impact

- term/state 변경은 retrieval policy, index schema, context packets, View copy와 tests를 바꿉니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: retrieval context language 초안을 작성했다.
