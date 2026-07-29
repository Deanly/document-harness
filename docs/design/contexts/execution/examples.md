---
type: design
design_kind: domain-examples
title: execution-domain-examples
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
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-29
retrieval_class:
  - domain-examples
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
  - examples
---

# execution-domain-examples

## Purpose

task 시작, attention, closeout과 목표 축소 거절을 같은 example로 파생합니다.

## Business Examples

| Scenario ID | Kind | Actor / Goal | Given | When / Command | Then / Event | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| SCN-EXEC-001 | normal | executor가 task 시작 | current model/authority refs | CMD-EXEC-START | EVT-EXEC-ATTEMPT-STARTED | BR-EXEC-001 |
| SCN-EXEC-002 | boundary | 외부 결정 필요 | exact question/resume condition | CMD-EXEC-REQUEST-ATTENTION | EVT-EXEC-ATTENTION-OPENED | BR-EXEC-002 |
| SCN-EXEC-003 | normal | reviewer가 task close | goal/evidence/receipt 모두 충족 | CMD-EXEC-CLOSE | EVT-EXEC-TASK-CLOSED | BR-EXEC-003, BR-EXEC-004 |
| SCN-EXEC-004 | rejection | 남은 goal을 후속 task로 넘기고 close | locked goal 미충족 | CMD-EXEC-CLOSE | incomplete 거절 | BR-EXEC-003 |

## Counterexamples

- `loop_state: succeeded`만으로 task `done` 표시
- 실행하지 않은 validator를 pass로 기록

## QA Derivation

| Scenario ID | QA Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| SCN-EXEC-001 | current domain refs | current+approved model refs 또는 approved none rationale | closeout validator |
| SCN-EXEC-003 | terminal evidence | goal 1:1 Done, receipts current, attention 없음 | execution validator |
| SCN-EXEC-004 | goal shrink reject | 남은 goal이 있으면 non-zero | closeout fixture |

## Unknowns And Disputes

- 사람 응답 SLA와 자동 escalation은 organization policy가 필요합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: execution examples 초안을 작성했다.
