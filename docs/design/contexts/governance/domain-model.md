---
type: design
design_kind: bounded-context
title: governance-domain-model
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
  - document-harness-maintainer
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
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/governance/policy-to-evidence.md
  - docs/governance/initiative-governance.md
source_refs:
  - docs/governance/policy-to-evidence.md
  - docs/governance/initiative-governance.md
tags:
  - docs/design
  - ddd
  - governance
---

# governance-domain-model

## Domain Purpose And Customer Outcome

사람의 정책적 의도와 위험 결정이 AI의 제안, 추진안과 delivery 과정에서 왜곡되지 않고 exact authority와 근거를 가진 상태로 전달되게 합니다.

## Domain Experts And Sources

- governance owner, policy owner, risk acceptor, initiative sponsor
- human policy source, guideline source, approval/exception receipt
- exact bytes 검토 전까지 이 모델은 review candidate입니다.

## Bounded Context Boundary

- 포함: policy/guideline candidate, proposal, approval, exception, effective artifact, initiative issuance/activation
- 제외: task 실행 상태와 checkpoint, 검색 구현, View UI
- downstream: BC-EXECUTION
- upstream: BC-ADOPTION과 human source

## Ubiquitous Language

| Term ID | Term | Meaning In This Context | Examples / Counterexamples | Avoid | Source / Expert |
| --- | --- | --- | --- | --- | --- |
| TERM-GOV-POLICY | human policy | 사람이 소유하는 WHY/경계와 risk authority | 승인된 policy clause / 코드 관찰 | code behavior를 policy로 부르기 | policy owner |
| TERM-GOV-PROPOSAL | proposal | 승인 전 option·해석·rule 후보 | AI draft / effective standard | accepted_for_promotion을 effective로 부르기 | governance owner |
| TERM-GOV-APPROVAL | approval receipt | exact candidate/source/effective bytes에 대한 사람 결정 | SHA가 일치하는 receipt / 채팅의 일반 동의 | approval 문자열만 기록 | approver |

## Domain Scenarios

| Scenario ID | Actor / Goal | Given | When / Command | Then / Domain Event | Related Rule |
| --- | --- | --- | --- | --- | --- |
| SCN-GOV-001 | policy owner가 후보를 검토 | source-fenced proposal이 있음 | CMD-GOV-APPROVE-POLICY | EVT-GOV-POLICY-APPROVED | BR-GOV-001 |
| SCN-GOV-002 | sponsor가 추진안을 활성화 | 발급된 draft와 current source가 있음 | CMD-GOV-ACTIVATE-INITIATIVE | EVT-GOV-INITIATIVE-ACTIVATED | BR-GOV-002 |
| SCN-GOV-003 | AI가 승인 없이 effective를 요청 | proposal만 있음 | CMD-GOV-ACTIVATE-INITIATIVE | 업무 거절 | BR-GOV-001 |

## Domain Model

### Aggregates

| Aggregate ID | Aggregate Root | Responsibility | Invariants | Commands | Events | Consistency Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| AGG-GOV-AUTHORITY | GovernanceItem | candidate, source fence, decision, effective artifact와 exception authority | BR-GOV-001, BR-GOV-003 | CMD-GOV-APPROVE-POLICY | EVT-GOV-POLICY-APPROVED | 한 item의 source/decision/effective bytes |
| AGG-GOV-INITIATIVE | Initiative | policy/guideline relationship, issuance, activation과 lifecycle | BR-GOV-002 | CMD-GOV-ACTIVATE-INITIATIVE | EVT-GOV-INITIATIVE-ACTIVATED | 한 initiative document/register/receipt |

### Entities

| Entity ID | Entity | Identity | Lifecycle | Owning Aggregate |
| --- | --- | --- | --- | --- |
| ENT-GOV-CANDIDATE | GovernanceCandidate | candidate ID | unreviewed → review_requested → approved/rejected | AGG-GOV-AUTHORITY |
| ENT-GOV-EXCEPTION | ScopedException | exception ID | proposed → active → expired/closed | AGG-GOV-AUTHORITY |

### Value Objects

| Value Object ID | Value Object | Meaning | Validity / Immutability | Used By |
| --- | --- | --- | --- | --- |
| VO-GOV-SOURCE-FENCE | SourceFence | source revision과 hashes | receipt 이후 immutable | GovernanceItem, Initiative |
| VO-GOV-APPROVAL-REF | ApprovalReference | human actor, time, decision과 effective hash | exact scope와 bytes 필요 | GovernanceItem, Initiative |

### Commands

| Command ID | Command | Actor | Target Aggregate | Preconditions | Result Event / Rejection |
| --- | --- | --- | --- | --- | --- |
| CMD-GOV-APPROVE-POLICY | ApproveGovernanceItem | authorized human | AGG-GOV-AUTHORITY | source/effective bytes current | EVT-GOV-POLICY-APPROVED 또는 stale 거절 |
| CMD-GOV-ACTIVATE-INITIATIVE | ActivateInitiative | authorized human | AGG-GOV-INITIATIVE | issued draft, policy/guideline refs, activation receipt | EVT-GOV-INITIATIVE-ACTIVATED 또는 authority 거절 |

### Domain Events

| Event ID | Domain Event | Producer | Business Meaning | Consumers | Published Contract |
| --- | --- | --- | --- | --- | --- |
| EVT-GOV-POLICY-APPROVED | GovernanceItemApproved | AGG-GOV-AUTHORITY | 특정 bytes가 effective authority가 됨 | BC-EXECUTION | stable rule ID + effective ref/hash |
| EVT-GOV-INITIATIVE-ACTIVATED | InitiativeActivated | AGG-GOV-INITIATIVE | delivery portfolio가 승인된 방향을 가짐 | BC-EXECUTION | I#### + relationships + receipt |

### Domain Policies And Services

| Policy / Service ID | Kind | Trigger | Decision / Coordination | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| POL-GOV-AUTHORITY | domain-service | approval/activation 요청 | human actor, source fence와 exact bytes 검증 | candidate, receipt, files | approved/rejected decision |

## Business Rules And Invariants

| Rule ID | Rule / Invariant | Scope | Enforced By | Scenario Coverage | QA Coverage |
| --- | --- | --- | --- | --- | --- |
| BR-GOV-001 | AI와 proposal은 자신을 승인하거나 effective로 만들 수 없다 | AGG-GOV-AUTHORITY | authority validator | SCN-GOV-001, SCN-GOV-003 | pending |
| BR-GOV-002 | initiative issuance와 activation은 별도 human decision이다 | AGG-GOV-INITIATIVE | initiative authority validator | SCN-GOV-002 | pending |
| BR-GOV-003 | approved/current authority는 exact source/effective bytes와 receipt가 일치해야 한다 | AGG-GOV-AUTHORITY | hash/receipt validator | SCN-GOV-001 | pending |

## State Transitions

| State Model | From | Command | Guard / Rule | To | Domain Event | Rejection |
| --- | --- | --- | --- | --- | --- | --- |
| GovernanceCandidate | review_requested | CMD-GOV-APPROVE-POLICY | BR-GOV-001, BR-GOV-003 | approved/effective | EVT-GOV-POLICY-APPROVED | stale/unauthorized |
| Initiative | draft | CMD-GOV-ACTIVATE-INITIATIVE | BR-GOV-002 | active | EVT-GOV-INITIATIVE-ACTIVATED | missing lineage/receipt |

## Context Relationships And Integration

| Related Context | Direction | Relationship Pattern | Contract / Translation | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-ADOPTION | upstream | Customer-Supplier | candidate/source fence | captured revision | Adoption: freshness, Governance: meaning |
| BC-EXECUTION | downstream | Published Language | policy/rule/I#### exact refs | task start/closeout pin | Execution rejects stale authority |

## Failure And Exception Semantics

- unauthorized와 stale은 업무 거절이며 자동 retry하지 않습니다.
- scoped exception은 base rule을 pass로 바꾸지 않고 scope/expiry/risk acceptor를 유지합니다.

## Role Consumer Contract

| Role | Questions This Model Answers | Required Sections / IDs | Required Downstream Output |
| --- | --- | --- | --- |
| customer | 정책 의미와 결과가 맞는가 | TERM-GOV-*, SCN-GOV-* | 의미 확인 |
| planner | 어떤 direction과 success signal이 필요한가 | BR-GOV-*, initiative event | initiative draft |
| architect | authority boundary와 published contract는 무엇인가 | AGG-GOV-*, EVT-GOV-* | governance integration |
| developer | 어떤 receipt/hash gate를 구현하는가 | CMD-GOV-*, BR-GOV-* | validator/code |
| qa | 어떤 승인·stale·거절을 검증하는가 | SCN-GOV-*, BR-GOV-* | QA checks |

## Traceability

| Model ID | Source / Expert | Project / Task | API / Event / Code | QA Check | Evidence |
| --- | --- | --- | --- | --- | --- |
| BR-GOV-001 | governance owner | future | initiative-authority.mjs | pending | validator tests |
| BR-GOV-003 | approver | future | receipt schemas | pending | hash tests |

## Decisions

- 승인 문자열이 아니라 exact receipt와 bytes를 aggregate invariant로 취급합니다.

## Unknowns And Disputes

- 조직별 authorized human role resolution과 signature profile은 downstream에서 결정해야 합니다.

## Change Impact

- rule/event 변경은 governance schemas, Initiative/project/task lineage, QA와 Board projection에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: governance bounded-context model 초안을 작성했다.
