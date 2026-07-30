---
type: design
design_kind: ubiquitous-language
title: execution-ubiquitous-language
display_title: 목표 중심 실행에서 함께 쓰는 말
human_summary: 작업을 진행하는 사람과 도구가 목표, 상태, 중단, 검토, 근거, 완료를 같은 뜻으로 이해하게 합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: execution
bounded_context_id: BC-EXECUTION
subdomain_type: core
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - delivery-owner
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
  - docs/design/contexts/execution/domain-model.md
source_refs:
  - docs/design/contexts/execution/domain-model.md
tags:
  - docs/design
  - ddd
  - execution
  - ubiquitous-language
---

# execution-ubiquitous-language

## Context Language Boundary

Execution의 `status`, `checkpoint`, `evidence`는 Governance approval이나 Retrieval revision과 다른 의미입니다.

## Terms

| Term ID | Term | Meaning In This Context | Examples | Counterexamples | Avoid / Alias | Source / Expert |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-EXEC-TASK | task | project 아래 goal-locked 실행 단위 | T#### | chat TODO | work item과 무분별 혼용 | delivery owner |
| TERM-EXEC-LOOP | loop state | 현재 attempt의 제어 상태 | running, awaiting_user | task done | lifecycle status와 합치기 | executor |
| TERM-EXEC-CHECKPOINT | execution checkpoint | resume 가능한 current snapshot | task-linked sequence | append-only Status | progress report | executor |
| TERM-EXEC-ATTENTION | attention request | 계속하려면 필요한 bounded human/external action | exact decision request | FYI | blocker 전부를 attention이라 부르기 | reviewer |
| TERM-EXEC-EVIDENCE | evidence receipt | goal/revision에 묶인 검증 사실 | test receipt | 활동 요약 | proof 없는 완료 | QA |

## State And Event Vocabulary

- task lifecycle: draft, active, blocked, done, cancelled, superseded
- loop: ready, running, awaiting_user, awaiting_external, needs_review, stopped, succeeded

## Cross-Context Translations

| Local Term | Related Context | Their Term | Translation / ACL Rule |
| --- | --- | --- | --- |
| normative ref | BC-GOVERNANCE | approved authority | stable ID + effective hash 필요 |
| source revision | BC-RETRIEVAL | document head/indexed revision | current/direct-read proof로 받음 |

## Ambiguities And Disputes

- “완료”는 activity end가 아니라 locked goal evidence가 충족된 terminal state입니다.

## Change Impact

- state/term 변경은 task/checkpoint schema, validator, Board와 QA를 함께 바꿉니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 제목과 요약, 보드 검토 상태를 추가했다.
- 2026-07-29: execution context language 초안을 작성했다.
