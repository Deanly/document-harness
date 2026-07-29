---
type: design
design_kind: ubiquitous-language
title: governance-ubiquitous-language
status: review_requested
domain: document-harness
bounded_context: governance
bounded_context_id: BC-GOVERNANCE
subdomain_type: core
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - governance-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-29
retrieval_class:
  - term-excerpt
context:
  default_load: false
  section_load: true
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/design/contexts/governance/domain-model.md
source_refs:
  - docs/design/contexts/governance/domain-model.md
tags:
  - docs/design
  - ddd
  - governance
  - ubiquitous-language
---

# governance-ubiquitous-language

## Context Language Boundary

이 용어는 BC-GOVERNANCE 안에서만 이 의미를 갖습니다. task lifecycle과 execution loop state를 governance approval state로 번역하지 않습니다.

## Terms

| Term ID | Term | Meaning In This Context | Examples | Counterexamples | Avoid / Alias | Source / Expert |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-GOV-POLICY | human policy | 사람이 소유하는 WHY, scope, non-waivable boundary | 승인된 policy clause | code/config observation | rule 전부를 policy라 부르기 | policy owner |
| TERM-GOV-GUIDELINE | guideline | policy를 적용하는 HOW와 verification direction | required/recommended guideline | 구현 task | standard와 혼용 | governance owner |
| TERM-GOV-PROPOSAL | proposal | 승인 전 option과 해석 후보 | AI standard proposal | effective artifact | accepted를 approved로 부르기 | reviewer |
| TERM-GOV-APPROVAL | approval receipt | exact source/effective bytes에 대한 human decision | matching SHA receipt | 채팅 동의 | approval flag | approver |
| TERM-GOV-INITIATIVE | initiative | policy/guideline을 delivery portfolio outcome으로 잇는 strategy owner | I#### | project | umbrella와 자동 동치 | sponsor |

## State And Event Vocabulary

- approval: `unreviewed`, `review_requested`, `approved`, `rejected`, `stale`, `superseded`
- authority: `proposed`, `accepted_for_promotion`, `effective`, `superseded`
- events: EVT-GOV-POLICY-APPROVED, EVT-GOV-INITIATIVE-ACTIVATED

## Cross-Context Translations

| Local Term | Related Context | Their Term | Translation / ACL Rule |
| --- | --- | --- | --- |
| approved rule | BC-EXECUTION | normative ref | stable ID + effective ref/hash로만 전달 |
| active initiative | BC-EXECUTION | project lineage | I####와 activation receipt로 전달 |

## Ambiguities And Disputes

- `standard`와 `guideline`의 조직별 권한 차이는 source authority로 확인해야 합니다.

## Change Impact

- term meaning 변경은 governance catalog/schema, initiative/task/QA와 Board label을 재검토합니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: governance context language 초안을 작성했다.
